const mongoose = require('mongoose');

// Sub‐document for each student’s submission
const submissionSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'User',
    required: true
  },
  answers: [
    {
      question: {
        type: mongoose.Schema.Types.ObjectId,
        ref:  'Question',
        required: true
      },
      response: {
        type: mongoose.Schema.Types.Mixed,
        required: true
      },
      isCorrect: Boolean
    }
  ],
  submittedAt: {
    type: Date,
    default: Date.now
  },
  grade: Number,
  feedback: String
}, { _id: false });

const assignmentSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  description: { type: String, default: '' },
 
  // mode: assignment, quiz, or test
  mode: {
    type: String,
    enum: ['assignment','quiz','test'],
    default: 'assignment'
  },

  // mentor dispatch control
  isDispatched: {
    type: Boolean,
    default: false
  },
  dispatchDate: Date,

  // timing
  startDate:       Date,             // for assignments
  dueDate:         Date,             
  timeLimitMinutes:Number,           

  questions: [    
    { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true }
  ],

  visibleToAll: { type: Boolean, default: true },
  visibleTo:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // embedded submissions
  submissions: [ submissionSchema ],
   // dispatch state:
  isDispatched:{ type:Boolean, default:false },
  dispatchDate:{ type:Date },

  createdBy: {  
    type: mongoose.Schema.Types.ObjectId,
    ref:  'User',
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Assignment', assignmentSchema);
