const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken'); 
require('dotenv').config();

// --- 1. IMPOR MODEL ---
const Card = require('./src/models/card');
const List = require('./src/models/list');
const User = require('./src/models/user'); 
const auth = require('./src/middleware/auth'); 

const app = express();
app.use(cors());
app.use(express.json());

// Pastikan port Anda 27017
const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/kanban";

// Koneksi ke MongoDB
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB terhubung...'))
  .catch(err => console.log(err));

// --- 2. RUTE API ---

// == RUTE PUBLIK (AUTENTIKASI) ==

app.get('/api', (req, res) => {
  res.json({ message: 'Halo dari Backend Express!' });
});

// SIGN UP (REGISTRASI) - SEKARANG DENGAN FUNGSI SEEDER
app.post('/api/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email dan password diperlukan' });
    }

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'Email sudah terdaftar' });
    }

    // 1. Buat User baru dan hash password
    user = new User({ email });
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();

    // 2. --- MEMBUAT LIST DEFAULT UNTUK USER BARU ---
    // (Ini menggantikan /api/seed)
    const newUserId = user.id; // Ambil ID user baru
    
    // Buat list default HANYA untuk user ini
    const listInbox = new List({ title: 'Inbox', cards: [], userId: newUserId });
    const listTodo = new List({ title: 'To Do', cards: [], userId: newUserId });
    const listProgress = new List({ title: 'In Progress', cards: [], userId: newUserId });
    const listDone = new List({ title: 'Done', cards: [], userId: newUserId });
    
    // Simpan semua list baru
    await listInbox.save();
    await listTodo.save();
    await listProgress.save();
    await listDone.save();
    // ---------------------------------------------

    // 3. Buat token agar user bisa langsung login
    const payload = { user: { id: newUserId } };
    jwt.sign(payload, 'jwtSecretSangatRahasia', { expiresIn: '5h' }, (err, token) => {
      if (err) throw err;
      res.status(201).json({ token }); // Kirim token
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// SIGN IN (LOGIN) - (Tidak berubah)
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email dan password diperlukan' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Email atau password salah' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Email atau password salah' });
    }
    const payload = { user: { id: user.id } };
    jwt.sign(payload, 'jwtSecretSangatRahasia', { expiresIn: '5h' }, (err, token) => {
      if (err) throw err;
      res.json({ token });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});


// == RUTE PRIVAT (PERLU LOGIN) ==

// Endpoint untuk MENGAMBIL semua data papan
// DIPERBARUI: Sekarang memfilter berdasarkan userId
app.get('/api/board', auth, async (req, res) => {
  try {
    // req.user.id didapat dari token (via middleware auth.js)
    // Ini HANYA akan menemukan list milik user yang login
    const lists = await List.find({ userId: req.user.id }).populate('cards');
    res.json(lists);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal mengambil data board" });
  }
});

// Endpoint untuk MEMBUAT KARTU (CARD) BARU
// DIPERBARUI: Menambahkan cek keamanan
app.post('/api/cards', auth, async (req, res) => {
  try {
    const { title, listId } = req.body;
    if (!title || !listId) {
      return res.status(400).json({ message: "Judul dan listId diperlukan" });
    }

    // Cek keamanan: Pastikan user ini pemilik list tersebut
    const list = await List.findOne({ _id: listId, userId: req.user.id });
    if (!list) {
      return res.status(404).json({ message: "List tidak ditemukan" });
    }

    const newCard = new Card({ title });
    await newCard.save();
    
    list.cards.push(newCard._id); // Tambahkan kartu ke list
    await list.save();
    
    res.status(201).json(newCard);
  } catch (err) {
    console.error('Error saat membuat kartu:', err);
    res.status(500).json({ message: 'Gagal membuat kartu' });
  }
});

// Endpoint untuk MENYIMPAN data perpindahan kartu
// DIPERBARUI: Menambahkan cek keamanan
app.put('/api/move', auth, async (req, res) => {
  const { cardId, sourceListId, destListId, newIndex } = req.body;
  const userId = req.user.id;

  try {
    // Cek keamanan: Pastikan user memiliki kedua list
    const sourceList = await List.findOne({ _id: sourceListId, userId: userId });
    const destList = await List.findOne({ _id: destListId, userId: userId });

    if (!sourceList || !destList) {
      return res.status(404).json({ message: "Satu atau kedua list tidak ditemukan" });
    }

    // Logika pindah kartu (aman)
    if (sourceListId === destListId) {
      // Pindah di list yang sama
      const card = sourceList.cards.find(id => id.toString() === cardId);
      sourceList.cards = sourceList.cards.filter(id => id.toString() !== cardId);
      sourceList.cards.splice(newIndex, 0, card);
      await sourceList.save();
    } else {
      // Pindah ke list berbeda
      sourceList.cards = sourceList.cards.filter(id => id.toString() !== cardId);
      await sourceList.save();
      
      destList.cards.splice(newIndex, 0, cardId);
      await destList.save();
    }
    res.json({ message: 'Papan berhasil diperbarui!' });
  } catch (err) {
    console.error('Error saat memindah kartu:', err);
    res.status(500).json({ message: 'Gagal memperbarui papan' });
  }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server berjalan di port ${PORT}`));