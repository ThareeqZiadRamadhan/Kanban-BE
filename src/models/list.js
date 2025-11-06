const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ListSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  // Menyimpan array dari ID Card
  cards: [{
    type: Schema.Types.ObjectId,
    ref: 'Card' 
  }],
  
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User', // Merujuk ke model 'User'
    required: true
  }
});

module.exports = mongoose.model('List', ListSchema);