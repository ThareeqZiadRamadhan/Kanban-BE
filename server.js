const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// --- 1. Impor Model Anda ---
// Pastikan Anda sudah membuat file-file ini di /backend/src/models/
const Card = require('./src/models/card');
const List = require('./src/models/list');

const app = express();
app.use(cors());
app.use(express.json());

// Ambil URI Mongo dari environment variable
const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/kanban";

// Koneksi ke MongoDB
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB terhubung...'))
  .catch(err => console.log(err));

// --- 2. Tambahkan API Endpoints Anda di sini ---

// Endpoint tes sederhana
app.get('/api', (req, res) => {
  res.json({ message: 'Halo dari Backend Express!' });
});

// Endpoint untuk MENGAMBIL semua data papan
app.get('/api/board', async (req, res) => {
  try {
    const lists = await List.find().populate('cards');
    res.json(lists);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal mengambil data board" });
  }
});

// !!! HANYA UNTUK SETUP AWAL (SEEDING) !!!
// Endpoint ini untuk membuat data awal
app.get('/api/seed', async (req, res) => {
  try {
    // Hapus data lama
    await Card.deleteMany({});
    await List.deleteMany({});

    // Buat beberapa Card
    const card1 = new Card({ title: 'Buat komponen Board' });
    const card2 = new Card({ title: 'Styling CSS dasar' });
    const card3 = new Card({ title: 'Setup Docker' });
    await card1.save();
    await card2.save();
    await card3.save();

    // Buat List dengan card di dalamnya
    const list1 = new List({ title: 'To Do', cards: [card1._id, card2._id] });
    const list2 = new List({ title: 'In Progress', cards: [card3._id] });
    const list3 = new List({ title: 'Done', cards: [] });

    const listInbox = new List({ title: 'Inbox', cards: [] }); // List baru untuk sidebar
    await listInbox.save();

    await list1.save();
    await list2.save();
    await list3.save();
    
    res.send('Database berhasil di-seed!');
  } catch(err) {
    res.status(500).send('Gagal melakukan seeding: ' + err.message);
  }
});

app.post('/api/cards', async (req, res) => {
  try {
    const { title, listId } = req.body;

    if (!title || !listId) {
      return res.status(400).json({ message: "Judul dan listId diperlukan" });
    }

    // 1. Buat kartu (card) baru
    const newCard = new Card({ title });
    await newCard.save();

    // 2. Tambahkan ID kartu baru itu ke array 'cards' di List yang sesuai
    await List.findByIdAndUpdate(listId, {
      $push: { cards: newCard._id }
    });

    // 3. Kirim kartu yang baru dibuat kembali ke frontend
    res.status(201).json(newCard); // 201 = 'Created'

  } catch (err) {
    console.error('Error saat membuat kartu:', err);
    res.status(500).json({ message: 'Gagal membuat kartu' });
  }
});

// Endpoint untuk menerima data perpindahan kartu
app.put('/api/move', async (req, res) => {
  const { cardId, sourceListId, destListId, newIndex } = req.body;

  try {
    // 1. Jika kartu dipindah di dalam list yang sama
    if (sourceListId === destListId) {
      const list = await List.findById(sourceListId);
      
      // Ambil kartu yang dipindah
      const card = list.cards.find(id => id.toString() === cardId);
      // Hapus dari posisi lama
      list.cards = list.cards.filter(id => id.toString() !== cardId);
      // Masukkan ke posisi baru
      list.cards.splice(newIndex, 0, card);
      
      await list.save();
      
    } else {
      // 2. Jika kartu dipindah ke list yang berbeda
      
      // Hapus kartu dari list asal (source)
      await List.findByIdAndUpdate(sourceListId, {
        $pull: { cards: cardId }
      });
      
      // Tambahkan kartu ke list tujuan (destination) di index yang benar
      await List.findByIdAndUpdate(destListId, {
        $push: {
          cards: {
            $each: [cardId],
            $position: newIndex
          }
        }
      });
    }

    res.json({ message: 'Papan berhasil diperbarui!' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal memperbarui papan' });
  }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server berjalan di port ${PORT}`));