import unittest

import numpy as np

from separate import CHUNK, separate


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


if __name__ == '__main__':
    unittest.main()
