// models/Submission.js
const mongoose = require('mongoose')

const answerSchema = new mongoose.Schema({
  question: { type: mongoose.Schema.Types.ObjectId, ref:'Question', required:true },
  // for MCQ: string, for MSQ: [string], for descriptive: string
  response: mongoose.Schema.Types.Mixed
}, { _id: false })

const testCaseResultSchema = new mongoose.Schema({
  input:  String,
  output: String
}, { _id: false })

const submissionSchema = new mongoose.Schema({
  assignment:     { type: mongoose.Schema.Types.ObjectId, ref:'Assignment', required:true },
  student:        { type: mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  answers:        [answerSchema],
  testCaseResults:[testCaseResultSchema],
  grade:          { type: Number, default: null },
  feedback:       { type: String, default: null },
  isFinal:        { type: Boolean, default: false },
  submittedAt:    { type: Date, default: Date.now }
})
submissionSchema.index({ assignment:1, student:1, isFinal:1 }, { unique:true });

module.exports = mongoose.model('Submission', submissionSchema)
 