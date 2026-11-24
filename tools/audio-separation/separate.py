"""Split a local WAV into aligned vocals and accompaniment with ONNX Runtime."""

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import tempfile

import numpy as np
import onnxruntime as ort
from scipy import fft, signal
from scipy.io import wavfile


MODEL_SHA256 = 'e9570dac2ae14382c99357a547a6739777a029ad7f2b5f6e6bc22e9b0e7b2580'
RATE = 44100
FFT_SIZE = 2048
HOP = 441
CHUNK = 352800
STEP = CHUNK // 2
FADE = RATE * 4 // 5
MAX_MIXER_SECONDS = 140
WINDOW = signal.windows.hann(FFT_SIZE, sym=False).astype(np.float32)


def read_mix(path):
    rate, raw = wavfile.read(path)
    if not raw.size or raw.ndim not in (1, 2) or (raw.ndim == 2 and raw.shape[1] not in (1, 2)):
        raise ValueError('Expected a nonempty mono or stereo WAV')
    if len(raw) / rate > MAX_MIXER_SECONDS:
        raise ValueError(f'Choose a WAV of at most {MAX_MIXER_SECONDS} seconds for the Worship mixer')
    if raw.dtype.kind == 'u':
        midpoint = 2 ** (8 * raw.dtype.itemsize - 1)
        mix = (raw.astype(np.float32) - midpoint) / midpoint
    elif raw.dtype.kind == 'i':
        mix = raw.astype(np.float32) / np.float32(2 ** (8 * raw.dtype.itemsize - 1))
    else:
        mix = raw.astype(np.float32)
    if not np.isfinite(mix).all():
        raise ValueError('Audio contains nonfinite samples')
    mix = mix.reshape(len(mix), -1).T
    if rate != RATE:
        divisor = np.gcd(rate, RATE)
        mix = signal.resample_poly(mix, RATE // divisor, rate // divisor, axis=1)
    return mix


def create_session(model):
    with model.open('rb') as stream:
        if hashlib.file_digest(stream, 'sha256').hexdigest() != MODEL_SHA256:
            raise ValueError('Model SHA-256 does not match the pinned quantized graph')
    options = ort.SessionOptions()
    options.intra_op_num_threads = 4
    return ort.InferenceSession(str(model), sess_options=options, providers=['CPUExecutionProvider'])


def separate_chunk(stereo, infer):
    pad = FFT_SIZE // 2
    padded = np.pad(stereo, ((0, 0), (pad, pad)), mode='reflect')
    frames = np.lib.stride_tricks.sliding_window_view(padded, FFT_SIZE, axis=1)[:, ::HOP]
    spec = fft.rfft(frames * WINDOW, axis=-1).transpose(0, 2, 1)
    planes = np.stack((spec[0].real, spec[0].imag, spec[1].real, spec[1].imag))[None]
    mask = infer(planes)
    if mask.shape != planes.shape or not np.isfinite(mask).all():
        raise ValueError('Invalid separator output')
    masked = spec * (mask[0, ::2] + 1j * mask[0, 1::2])
    masked[:, 0] = 0
    frames = fft.irfft(masked.transpose(0, 2, 1), n=FFT_SIZE, axis=-1) * WINDOW
    vocals = np.zeros_like(padded)
    weights = np.zeros(padded.shape[1], dtype=np.float32)
    for index in range(frames.shape[1]):
        start = index * HOP
        vocals[:, start:start + FFT_SIZE] += frames[:, index]
        weights[start:start + FFT_SIZE] += WINDOW ** 2
    return vocals[:, pad:-pad] / weights[pad:-pad]


def separate(mix, infer, progress):
    frames = mix.shape[1]
    vocals = np.zeros_like(mix)
    weights = np.zeros(frames, dtype=np.float32)
    fade = np.linspace(0, 1, FADE, dtype=np.float32)
    for start in range(0, frames, STEP):
        length = min(CHUNK, frames - start)
        end = start + length
        stereo = mix[:, start:end]
        if len(stereo) == 1:
            stereo = np.repeat(stereo, 2, axis=0)
        chunk = np.pad(stereo, ((0, 0), (0, CHUNK - length)))
        output = separate_chunk(chunk, infer)[:, :length]
        if len(mix) == 1:
            output = output.mean(axis=0, keepdims=True)
        envelope = np.ones(length, dtype=np.float32)
        if start:
            envelope[:FADE] = fade
        if end < frames:
            envelope[-FADE:] = fade[::-1]
        vocals[:, start:end] += output * envelope
        weights[start:end] += envelope
        progress(end, frames)
        if end == frames:
            break
    vocals /= weights
    return vocals, mix - vocals


def encode_stems(vocals, backing, vocals_target, backing_target):
    # Apply a single gain before PCM encoding to preserve balance between stems.
    peak = max(1, float(np.max(np.abs(vocals))), float(np.max(np.abs(backing))))
    for stem, target in ((vocals, vocals_target), (backing, backing_target)):
        wavfile.write(target, RATE, np.rint(stem.T * (32767 / peak)).astype(np.int16))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path, help='New directory for the two WAV files')
    parser.add_argument('--model', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error('The output directory must be new')
    mix = read_mix(args.input)
    session = create_session(args.model)
    vocals, backing = separate(mix, lambda spec: session.run(['mask'], {'spec': spec})[0],
                               lambda done, total: print(json.dumps({'frames': done, 'total': total}), flush=True))
    staging = Path(tempfile.mkdtemp(prefix='.lvm-separation-', dir=args.output.parent))
    try:
        encode_stems(vocals, backing, staging / 'vocals.wav', staging / 'accompaniment.wav')
        staging.rename(args.output)
    finally:
        if staging.exists():
            shutil.rmtree(staging)


if __name__ == '__main__':
    main()
