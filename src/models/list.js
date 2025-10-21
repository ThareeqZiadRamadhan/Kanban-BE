const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ListSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  // Ini penting: List akan berisi array dari ID Card
  // Ini cara kita menyimpan urutan kartu
  cards: [{
    type: Schema.Types.ObjectId,
    ref: 'Card' // Merujuk ke model 'Card'
  }]
});

module.exports = mongoose.model('List', ListSchema);