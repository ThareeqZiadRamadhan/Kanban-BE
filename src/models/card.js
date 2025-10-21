const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CardSchema = new Schema({
  title: {
    type: String,
    required: true
  }
  // Nanti bisa ditambah 'description', 'labels', dll.
});

module.exports = mongoose.model('Card', CardSchema);