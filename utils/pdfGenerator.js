// =====================================================
// OPTION A: Using html-pdf (Lightweight alternative)
// =====================================================

// 1. Install html-pdf instead
// npm install html-pdf


//--->> Not in use for now, we are creating pdf from the browser directly <<<-------------- 
//--->> Not in use for now, we are creating pdf from the browser directly <<<-------------- 
//--->> Not in use for now, we are creating pdf from the browser directly <<<-------------- 
//--->> Not in use for now, we are creating pdf from the browser directly <<<-------------- 
//--->> Not in use for now, we are creating pdf from the browser directly <<<-------------- 
//--->> Not in use for now, we are creating pdf from the browser directly <<<-------------- 



// utils/pdfGenerator.js (Alternative using html-pdf)
const pdf = require('html-pdf');
const fs = require('fs');
const path = require('path');

const generateAssignmentPDF = async ({
  assignment,
  user,
  studentSubmission = null,
  includeResponses = false 
}) => {
  return new Promise((resolve, reject) => {
    const htmlContent = generateAssignmentHTML({
      assignment,
      user,
      studentSubmission,
      includeResponses
    });

    const options = {
      format: 'A4',
      orientation: 'portrait',
      border: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      },
      header: {
        height: '20mm',
        contents: `
          <div style="text-align: center; font-size: 10px; color: #666;">
            ${assignment.title} - ${user.name}
          </div>
        `
      },
      footer: {
        height: '20mm',
        contents: {
          default: '<div style="text-align: center; font-size: 10px; color: #666;">{{page}}/{{pages}}</div>'
        }
      }
    };

    pdf.create(htmlContent, options).toBuffer((err, buffer) => {
      if (err) {
        reject(err);
      } else {
        resolve(buffer);
      }
    });
  });
};

// Same generateAssignmentHTML function from previous implementation
const generateAssignmentHTML = ({ assignment, user, studentSubmission, includeResponses }) => {
  // ... (same HTML generation code as before)
  // Copy the HTML generation function from the previous artifact
};

module.exports = { generateAssignmentPDF };

// =====================================================
// OPTION B: Frontend-Only PDF (No server dependency)
// =====================================================

// Install jsPDF for frontend PDF generation
// npm install jspdf html2canvas

// Add this to your AssignmentDetail.jsx component
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const handleDownloadPdfFrontend = useCallback(async () => {
  setDownloadingPdf(true);
  
  try {
    // Create a printable version of the page
    const printContent = document.createElement('div');
    printContent.innerHTML = `
      <div style="padding: 20px; font-family: Arial, sans-serif;">
        <h1>${assignment.title}</h1>
        <h2>Student: ${user.name}</h2>
        
        ${hasStudentSubmission ? `
        <div style="background: #f0f8f0; padding: 20px; margin: 20px 0; border-radius: 10px;">
          <h3>Performance Summary</h3>
          <p>Score: ${studentPerformance.percentage}%</p>
          <p>Correct: ${studentPerformance.correctAnswers}</p>
          <p>Incorrect: ${studentPerformance.incorrectAnswers}</p>
          <p>Skipped: ${studentPerformance.unattempted}</p>
        </div>
        ` : ''}
        
        <div>
          <h3>Questions</h3>
          ${(hasStudentSubmission ? questionsWithResponses : questions).map((q, i) => `
            <div style="margin: 20px 0; border: 1px solid #ccc; padding: 15px;">
              <h4>Question ${i + 1} ${hasStudentSubmission ? (q.isCorrect ? '✅' : q.isAttempted ? '❌' : '⚠️') : ''}</h4>
              <div>${q.content.replace(/<[^>]*>/g, '')}</div>
              
              ${q.options ? `
              <div style="margin: 10px 0;">
                ${q.options.map(opt => `
                  <div style="padding: 5px; margin: 5px 0; ${
                    q.correctAnswers?.includes(opt.id) ? 'background: #d4edda;' : ''
                  } ${
                    hasStudentSubmission && q.studentResponse && 
                    (Array.isArray(q.studentResponse) ? q.studentResponse.includes(opt.id) : q.studentResponse === opt.id) ? 
                    (q.correctAnswers?.includes(opt.id) ? 'border: 2px solid green;' : 'border: 2px solid red;') : ''
                  }">
                    ${opt.id}. ${opt.text}
                  </div>
                `).join('')}
              </div>
              ` : ''}
              
              ${hasStudentSubmission && q.studentResponse ? `
              <div style="background: #e3f2fd; padding: 10px; margin: 10px 0;">
                Your Answer: ${Array.isArray(q.studentResponse) ? q.studentResponse.join(', ') : q.studentResponse}
              </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Convert to canvas and then PDF
    const canvas = await html2canvas(printContent);
    const imgData = canvas.toDataURL('image/png');
    
    const doc = new jsPDF();
    const imgWidth = 210;
    const pageHeight = 295;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;

    let position = 0;

    doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      doc.addPage();
      doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // Download the PDF
    const fileName = `${assignment.title.replace(/[^a-zA-Z0-9]/g, '_')}_${user.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    doc.save(fileName);
    
    toast.success('PDF downloaded successfully!');
  } catch (error) {
    console.error('PDF generation error:', error);
    toast.error('Failed to generate PDF. Please try again.');
  } finally {
    setDownloadingPdf(false);
  }
}, [assignment, user, hasStudentSubmission, studentPerformance, questionsWithResponses, questions]);

// =====================================================
// OPTION C: Using PDFKit (Node.js native)
// =====================================================

// Install PDFKit
// npm install pdfkit

// utils/pdfGenerator.js (Using PDFKit)
const PDFDocument = require('pdfkit');

const generateAssignmentPDF = async ({
  assignment,
  user,
  studentSubmission = null,
  includeResponses = false
}) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(20).text(assignment.title, 50, 50);
      doc.fontSize(14).text(`Student: ${user.name}`, 50, 80);
      doc.fontSize(12).text(`Mode: ${assignment.mode?.toUpperCase() || 'ASSIGNMENT'}`, 50, 100);
      
      let yPosition = 140;

      // Performance Summary (if student has submitted)
      if (includeResponses && studentSubmission) {
        const totalQuestions = assignment.questions.length;
        const correctAnswers = studentSubmission.grade || 0;
        const percentage = Math.round((correctAnswers / totalQuestions) * 100);

        doc.fontSize(16).text('Performance Summary', 50, yPosition);
        yPosition += 30;
        
        doc.fontSize(12)
           .text(`Score: ${percentage}%`, 50, yPosition)
           .text(`Correct: ${correctAnswers}`, 200, yPosition)
           .text(`Total: ${totalQuestions}`, 350, yPosition);
        
        yPosition += 40;
      }

      // Questions
      doc.fontSize(16).text('Questions', 50, yPosition);
      yPosition += 30;

      assignment.questions.forEach((question, index) => {
        if (yPosition > 700) {
          doc.addPage();
          yPosition = 50;
        }

        // Question title
        doc.fontSize(14).text(`Question ${index + 1}`, 50, yPosition);
        yPosition += 20;

        // Question content
        const questionText = question.content.replace(/<[^>]*>/g, '').substring(0, 200);
        doc.fontSize(11).text(questionText, 50, yPosition, { width: 500 });
        yPosition += Math.ceil(questionText.length / 80) * 15 + 10;

        // Options
        if (question.options) {
          question.options.forEach(option => {
            const isCorrect = question.correctAnswers?.includes(option.id);
            const prefix = isCorrect ? '✓' : ' ';
            doc.text(`${prefix} ${option.id}. ${option.text}`, 70, yPosition);
            yPosition += 15;
          });
        }

        // Student response (if applicable)
        if (includeResponses && studentSubmission) {
          const studentAnswer = studentSubmission.answers.find(ans => 
            ans.question.toString() === question._id.toString()
          );
          
          if (studentAnswer) {
            const response = Array.isArray(studentAnswer.response) ? 
              studentAnswer.response.join(', ') : studentAnswer.response;
            doc.fontSize(10).text(`Your Answer: ${response}`, 70, yPosition);
            yPosition += 20;
          }
        }

        yPosition += 10;
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = { generateAssignmentPDF };

// =====================================================
// OPTION D: Browser Print API (Simplest)
// =====================================================

// Add this to your AssignmentDetail.jsx component
const handlePrintToPdf = useCallback(() => {
  // Create a print-friendly version
  const printWindow = window.open('', '_blank');
  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${assignment.title} - ${user.name}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .question { margin: 20px 0; border: 1px solid #ccc; padding: 15px; }
        .correct { background: #d4edda; }
        .incorrect { background: #f8d7da; }
        .student-answer { background: #e3f2fd; padding: 10px; margin: 10px 0; }
        @media print { 
          .no-print { display: none; }
          .question { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <h1>${assignment.title}</h1>
      <h2>Student: ${user.name}</h2>
      <p>Mode: ${assignment.mode?.toUpperCase() || 'ASSIGNMENT'}</p>
      
      ${hasStudentSubmission ? `
      <div style="background: #f0f8f0; padding: 20px; margin: 20px 0;">
        <h3>Performance Summary</h3>
        <p>Score: ${studentPerformance.percentage}%</p>
        <p>Correct: ${studentPerformance.correctAnswers} | Incorrect: ${studentPerformance.incorrectAnswers} | Skipped: ${studentPerformance.unattempted}</p>
      </div>
      ` : ''}
      
      <h3>Questions</h3>
      ${(hasStudentSubmission ? questionsWithResponses : questions).map((q, i) => `
        <div class="question">
          <h4>Question ${i + 1} ${hasStudentSubmission ? (q.isCorrect ? '✅ Correct' : q.isAttempted ? '❌ Incorrect' : '⚠️ Not Attempted') : ''}</h4>
          <div>${q.content}</div>
          
          ${q.options ? `
          <div style="margin: 15px 0;">
            <strong>Options:</strong>
            ${q.options.map(opt => `
              <div style="padding: 8px; margin: 5px 0;" 
                   class="${q.correctAnswers?.includes(opt.id) ? 'correct' : ''} ${
                     hasStudentSubmission && q.studentResponse && 
                     (Array.isArray(q.studentResponse) ? q.studentResponse.includes(opt.id) : q.studentResponse === opt.id) && 
                     !q.correctAnswers?.includes(opt.id) ? 'incorrect' : ''
                   }">
                ${opt.id}. ${opt.text}
              </div>
            `).join('')}
          </div>
          ` : ''}
          
          ${hasStudentSubmission && q.studentResponse ? `
          <div class="student-answer">
            <strong>Your Answer:</strong> ${Array.isArray(q.studentResponse) ? q.studentResponse.join(', ') : q.studentResponse}
          </div>
          ` : ''}
        </div>
      `).join('')}
      
      <button class="no-print" onclick="window.print()" 
              style="position: fixed; top: 10px; right: 10px; padding: 10px; background: blue; color: white; border: none; border-radius: 5px;">
        Print to PDF
      </button>
    </body>
    </html>
  `;
  
  printWindow.document.write(printContent);
  printWindow.document.close();
  
  // Auto-trigger print dialog
  setTimeout(() => {
    printWindow.print();
  }, 1000);
}, [assignment, user, hasStudentSubmission, studentPerformance, questionsWithResponses, questions]);