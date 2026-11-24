import unittest
from io import BytesIO
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from threading import Thread
import struct

import numpy as np
from scipy.io import wavfile

from separate import CHUNK, separate
from serve import build_handler


class SeparationTest(unittest.TestCase):
    def test_overlapping_chunks_preserve_a_stereo_signal_and_sample_count(self):
        rng = np.random.default_rng(42)
        mix = rng.normal(0, 0.1, size=(2, CHUNK + 127)).astype(np.float32)
        expected = mix.copy()
        progress = []

        def identity_mask(planes):
            mask = np.zeros_like(planes)
            mask[:, ::2] = 1
            return mask

        vocals, backing = separate(mix, identity_mask, lambda done, total: progress.append((done, total)))
        np.testing.assert_array_equal(mix, expected)
        np.testing.assert_allclose(vocals + backing, mix, rtol=0, atol=1e-7)
        # DC is removed per frequency frame, so the mask is nearly identity.
        self.assertLess(float(np.sqrt(np.mean(backing ** 2))), 0.005)
        self.assertEqual(vocals.shape, mix.shape)
        self.assertEqual(progress, [(CHUNK, CHUNK + 127), (CHUNK + 127, CHUNK + 127)])

    def test_short_mono_input_keeps_mono_and_length(self):
        mix = np.ones((1, 100), dtype=np.float32) / 2
        vocals, backing = separate(mix, np.zeros_like, lambda *_: None)
        np.testing.assert_array_equal(vocals, np.zeros_like(mix))
        np.testing.assert_array_equal(backing, mix)

    def test_local_response_frames_both_wavs_and_checks_origin(self):
        origin = 'http://127.0.0.1:5173'
        wave = BytesIO()
        wavfile.write(wave, 44100, np.ones(100, dtype=np.int16))
        with ThreadingHTTPServer(('127.0.0.1', 0), build_handler(origin, np.zeros_like)) as server:
            thread = Thread(target=server.serve_forever)
            thread.start()
            try:
                for caller, expected in [('https://example.org', 403), (origin, 200)]:
                    conn = HTTPConnection('127.0.0.1', server.server_port, timeout=5)
                    try:
                        conn.request('POST', '/separate', wave.getvalue(), {
                            'Origin': caller, 'Content-Type': 'application/octet-stream',
                        })
                        response = conn.getresponse()
                        self.assertEqual(response.status, expected)
                        packet = response.read()
                    finally:
                        conn.close()
                size, = struct.unpack_from('<I', packet)
                for data in (packet[4:4 + size], packet[4 + size:]):
                    rate, samples = wavfile.read(BytesIO(data))
                    self.assertEqual(rate, 44100)
                    self.assertEqual(len(samples), 100)
            finally:
                server.shutdown()
                thread.join()


if __name__ == '__main__':
    unittest.main()
