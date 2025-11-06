// File: /backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  // Ambil token dari header
  const token = req.header('x-auth-token');

  // Cek jika tidak ada token
  if (!token) {
    return res.status(401).json({ message: 'Tidak ada token, otorisasi ditolak' });
  }

  // Verifikasi token
  try {
    const decoded = jwt.verify(token, 'jwtSecretSangatRahasia'); // Pastikan secret-nya sama
    req.user = decoded.user; // Simpan data user ke request
    next(); // Lanjutkan ke rute berikutnya
  } catch (err) {
    res.status(401).json({ message: 'Token tidak valid' });
  }
};