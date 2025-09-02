# Tech Society Practice Arena - API Reference

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [User Management](#user-management) 
3. [Question Management](#question-management)
4. [Assignment Management](#assignment-management)
5. [Submission System](#submission-system)
6. [Code Execution](#code-execution)
7. [Statistics & Analytics](#statistics--analytics)
8. [File Upload](#file-upload)
9. [Data Models Reference](#data-models-reference)
10. [Error Handling](#error-handling)

---

## Base URL

```
Development: http://localhost:5000/api
Production:  https://your-domain.com/api
```

## Authentication & Authorization

### Authentication Routes

#### Register New User
```http
POST /auth/register
```

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@university.edu",
  "password": "SecurePass123",
  "branch": "Computer Science",
  "year": "3rd Year"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Registration successful—please check your email to verify."
}
```

**Response (400 Bad Request):**
```json
{
  "success": false,
  "message": "Email already in use"
}
```

#### Verify Email
```http
GET /auth/verify/:token
```

**URL Parameters:**
- `token` (string): Email verification token from email

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Email verified"
}
```

#### User Login
```http
POST /auth/login
```

**Request Body:**
```json
{
  "email": "john@university.edu",
  "password": "SecurePass123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "64a7b8c9d0e1f2g3h4i5j6k7",
      "name": "John Doe",
      "email": "john@university.edu",
      "role": "student",
      "branch": "Computer Science",
      "year": "3rd Year"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Response (401 Unauthorized):**
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

**Response (403 Forbidden):**
```json
{
  "success": false,
  "message": "Please verify email first"
}
```

#### Forgot Password
```http
POST /auth/forgot-password
```

**Request Body:**
```json
{
  "email": "john@university.edu"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Reset email sent"
}
```

#### Reset Password
```http
POST /auth/reset-password/:token
```

**URL Parameters:**
- `token` (string): Password reset token from email

**Request Body:**
```json
{
  "password": "NewSecurePass456"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password updated"
}
```

#### Get Current User
```http
GET /auth/me
```

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "_id": "64a7b8c9d0e1f2g3h4i5j6k7",
    "name": "John Doe",
    "email": "john@university.edu",
    "role": "student",
    "branch": "Computer Science",
    "year": "3rd Year",
    "isVerified": true,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## User Management

**All routes require authentication. Admin/Mentor authorization specified per endpoint.**

### Get All Active Users
```http
GET /users
```

**Authorization:** Admin, Mentor

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64a7b8c9d0e1f2g3h4i5j6k7",
      "name": "John Doe",
      "email": "john@university.edu",
      "role": "student"
    }
  ]
}
```

### Get Users by Role with Completion Stats
```http
GET /users/by-role?role=student
```

**Authorization:** Admin, Mentor

**Query Parameters:**
- `role` (string, required): user role (student|mentor|admin)

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64a7b8c9d0e1f2g3h4i5j6k7",
      "name": "John Doe",
      "email": "john@university.edu",
      "role": "student",
      "branch": "Computer Science",
      "year": "3rd Year",
      "completedAssignments": 8
    }
  ]
}
```

### Get Student Profile with Activity
```http
GET /users/:id
```

**Authorization:** Admin, Mentor

**URL Parameters:**
- `id` (ObjectId): User ID

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "_id": "64a7b8c9d0e1f2g3h4i5j6k7",
    "name": "John Doe",
    "email": "john@university.edu",
    "branch": "Computer Science",
    "year": "3rd Year",
    "submissions": [
      {
        "_id": "64b1c2d3e4f5g6h7i8j9k0l1",
        "assignmentTitle": "JavaScript Fundamentals Quiz",
        "grade": 8,
        "submittedAt": "2024-01-20T14:30:00.000Z"
      }
    ],
    "ongoing": [
      {
        "_id": "64c2d3e4f5g6h7i8j9k0l1m2",
        "title": "Data Structures Assignment",
        "dueDate": "2024-02-15T23:59:59.000Z"
      }
    ]
  }
}
```

---

## Question Management

**All routes require authentication. Create/Update/Delete require Admin/Mentor authorization.**

### Create Question(s)
```http
POST /questions
```

**Authorization:** Admin, Mentor

**Request Body (Single Question):**
```json
{
  "type": "mcq",
  "content": "What is the time complexity of binary search?",
  "options": [
    {"id": "A", "text": "O(n)"},
    {"id": "B", "text": "O(log n)"},
    {"id": "C", "text": "O(n²)"},
    {"id": "D", "text": "O(1)"}
  ],
  "correctAnswers": ["B"],
  "explanation": "Binary search divides the search space in half each iteration.",
  "tags": {
    "topics": ["algorithms", "complexity"],
    "difficulty": "intermediate"
  }
}
```

**Request Body (Bulk Creation):**
```json
[
  { /* question 1 */ },
  { /* question 2 */ },
  { /* question 3 */ }
]
```

**Request Body (Coding Question):**
```json
{
  "type": "coding",
  "content": "Write a function to reverse a number",
  "testCases": [
    {"input": "1234", "expected": "4321"},
    {"input": "567", "expected": "765"}
  ],
  "explanation": "Convert to string, reverse, convert back to integer",
  "tags": {
    "topics": ["programming", "strings"],
    "difficulty": "beginner"
  },
  "platformConfig": {
    "allowedLanguages": ["python", "javascript"],
    "timeLimit": 5,
    "memoryLimit": 128,
    "gradingType": "all-or-nothing",
    "starterCode": {
      "python": "def reverse_number(num):\n    # Write your code here\n    pass"
    }
  }
}
```

**Response (201 Created - Single):**
```json
{
  "success": true,
  "data": {
    "_id": "64e5f6g7h8i9j0k1l2m3n4o5",
    "type": "mcq",
    "content": "What is the time complexity of binary search?",
    "options": [
      {"id": "A", "text": "O(n)"},
      {"id": "B", "text": "O(log n)"},
      {"id": "C", "text": "O(n²)"},
      {"id": "D", "text": "O(1)"}
    ],
    "correctAnswers": ["B"],
    "explanation": "Binary search divides the search space in half each iteration.",
    "tags": {
      "topics": ["algorithms", "complexity"],
      "difficulty": "intermediate",
      "creator": {
        "_id": "64a7b8c9d0e1f2g3h4i5j6k7",
        "name": "Dr. Smith",
        "email": "smith@university.edu"
      }
    },
    "usageCount": 0,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Response (201 Created - Bulk):**
```json
{
  "success": true,
  "data": [
    { /* question 1 populated */ },
    { /* question 2 populated */ },
    { /* question 3 populated */ }
  ]
}
```

### Get All Questions
```http
GET /questions
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64e5f6g7h8i9j0k1l2m3n4o5",
      "type": "mcq",
      "content": "What is the time complexity of binary search?",
      "options": [...],
      "correctAnswers": ["B"],
      "explanation": "Binary search divides the search space in half each iteration.",
      "tags": {
        "topics": ["algorithms", "complexity"],
        "difficulty": "intermediate",
        "creator": {
          "_id": "64a7b8c9d0e1f2g3h4i5j6k7",
          "name": "Dr. Smith",
          "email": "smith@university.edu"
        }
      },
      "usageCount": 5,
      "lastUsedAt": "2024-01-20T14:30:00.000Z",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### Get Single Question
```http
GET /questions/:id
```

**URL Parameters:**
- `id` (ObjectId): Question ID

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "_id": "64e5f6g7h8i9j0k1l2m3n4o5",
    "type": "mcq",
    "content": "What is the time complexity of binary search?",
    "options": [
      {"id": "A", "text": "O(n)"},
      {"id": "B", "text": "O(log n)"},
      {"id": "C", "text": "O(n²)"},
      {"id": "D", "text": "O(1)"}
    ],
    "correctAnswers": ["B"],
    "explanation": "Binary search divides the search space in half each iteration.",
    "tags": {
      "topics": ["algorithms", "complexity"],
      "difficulty": "intermediate",
      "creator": {
        "_id": "64a7b8c9d0e1f2g3h4i5j6k7",
        "name": "Dr. Smith",
        "email": "smith@university.edu"
      }
    },
    "usageCount": 5,
    "lastUsedAt": "2024-01-20T14:30:00.000Z",
    "lastUsedIn": "64h8i9j0k1l2m3n4o5p6q7r8",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-20T14:30:00.000Z"
  }
}
```

### Update Question
```http
PUT /questions/:id
```

**Authorization:** Admin, Mentor

**URL Parameters:**
- `id` (ObjectId): Question ID

**Request Body (Partial Update):**
```json
{
  "content": "Updated: What is the time complexity of binary search?",
  "explanation": "Updated explanation with more details...",
  "tags": {
    "difficulty": "advanced"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    // Updated question object with merged changes
    "_id": "64e5f6g7h8i9j0k1l2m3n4o5",
    "content": "Updated: What is the time complexity of binary search?",
    "explanation": "Updated explanation with more details...",
    "tags": {
      "topics": ["algorithms", "complexity"],
      "difficulty": "advanced",
      "creator": {
        "_id": "64a7b8c9d0e1f2g3h4i5j6k7",
        "name": "Dr. Smith",
        "email": "smith@university.edu"
      }
    }
  }
}
```

### Delete Question
```http
DELETE /questions/:id
```

**Authorization:** Admin, Mentor

**URL Parameters:**
- `id` (ObjectId): Question ID

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Deleted"
}
```

### Question Usage Analytics
```http
GET /questions/usage-stats?page=1&limit=10&showUnused=false
```

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10)
- `showUnused` (boolean, optional): Show only unused questions (default: false)

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64e5f6g7h8i9j0k1l2m3n4o5",
      "type": "mcq",
      "content": "What is the time complexity of binary search?",
      "usageCount": 8,
      "recentUsageCount": 3,
      "lastUsage": "2024-01-20T14:30:00.000Z",
      "usageHistory": [
        {
          "assignment": "64f6g7h8i9j0k1l2m3n4o5p6",
          "assignmentTitle": "Algorithm Quiz 1",
          "assignmentType": "quiz",
          "usedBy": "64a7b8c9d0e1f2g3h4i5j6k7",
          "usedAt": "2024-01-20T14:30:00.000Z"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "hasMore": true
  }
}
```

### Question Usage History
```http
GET /questions/:questionId/usage-history
```

**URL Parameters:**
- `questionId` (ObjectId): Question ID

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "question": "What is the time complexity...",
    "totalUsage": 5,
    "history": [
      {
        "_id": "64g7h8i9j0k1l2m3n4o5p6q7",
        "assignment": {
          "_id": "64f6g7h8i9j0k1l2m3n4o5p6",
          "title": "Data Structures Quiz",
          "mode": "quiz",
          "createdAt": "2024-01-15T10:30:00.000Z"
        },
        "usedBy": {
          "_id": "64a7b8c9d0e1f2g3h4i5j6k7",
          "name": "Dr. Smith",
          "email": "smith@university.edu"
        },
        "usedAt": "2024-01-20T14:30:00.000Z"
      }
    ]
  }
}
```

### Usage Analytics Summary
```http
GET /questions/analytics/usage-summary?startDate=2024-01-01&endDate=2024-01-31
```

**Authorization:** Admin, Mentor

**Query Parameters:**
- `startDate` (ISO date, optional): Start date for analytics (default: 30 days ago)
- `endDate` (ISO date, optional): End date for analytics (default: today)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "topUsedQuestions": [
      {
        "_id": "64e5f6g7h8i9j0k1l2m3n4o5",
        "usageCount": 12,
        "lastUsed": "2024-01-25T09:15:00.000Z",
        "assignments": ["64f6g7h8i9j0k1l2m3n4o5p6", "64g7h8i9j0k1l2m3n4o5p6q7"],
        "question": {
          "content": "What is the time complexity of binary search?",
          "type": "mcq"
        }
      }
    ],
    "totalQuestions": 245,
    "usedQuestionsCount": 189,
    "unusedQuestionsCount": 56,
    "utilizationRate": 77
  }
}
```

---

## Assignment Management

**All routes require authentication. Create/Update/Delete require Admin/Mentor authorization unless specified.**

### Create Assignment
```http
POST /assignments
```

**Authorization:** Admin, Mentor

**Request Body:**
```json
{
  "title": "JavaScript Fundamentals Quiz",
  "description": "Test your knowledge of JavaScript basics including variables, functions, and closures.",
  "mode": "quiz",
  "questions": [
    "64e5f6g7h8i9j0k1l2m3n4o5",
    "64f6g7h8i9j0k1l2m3n4o5p6",
    "64g7h8i9j0k1l2m3n4o5p6q7"
  ],
  "visibleToAll": true,
  "visibleTo": [],
  "startDate": "2024-02-01T00:00:00.000Z",
  "dueDate": "2024-02-07T23:59:59.000Z",
  "timeLimitMinutes": 60
}
```

**Request Body (Restricted Visibility):**
```json
{
  "title": "Advanced Data Structures Test",
  "description": "Comprehensive test on advanced data structures",
  "mode": "test",
  "questions": ["64e5f6g7h8i9j0k1l2m3n4o5"],
  "visibleToAll": false,
  "visibleTo": [
    "64s1t2u3v4w5x6y7z8a9b0c1",
    "64t2u3v4w5x6y7z8a9b0c1d2"
  ],
  "startDate": "2024-02-01T00:00:00.000Z",
  "dueDate": "2024-02-01T02:00:00.000Z",
  "timeLimitMinutes": 120
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "_id": "64h8i9j0k1l2m3n4o5p6q7r8",
    "title": "JavaScript Fundamentals Quiz",
    "description": "Test your knowledge of JavaScript basics including variables, functions, and closures.",
    "mode": "quiz",
    "isDispatched": false,
    "questions": [
      "64e5f6g7h8i9j0k1l2m3n4o5",
      "64f6g7h8i9j0k1l2m3n4o5p6",
      "64g7h8i9j0k1l2m3n4o5p6q7"
    ],
    "visibleToAll": true,
    "visibleTo": [],
    "createdBy": "64a7b8c9d0e1f2g3h4i5j6k7",
    "startDate": "2024-02-01T00:00:00.000Z",
    "dueDate": "2024-02-07T23:59:59.000Z",
    "timeLimitMinutes": 60,
    "submissions": [],
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### Get All Assignments (Mentor/Admin View)
```http
GET /assignments
```

**Authorization:** Admin, Mentor

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64h8i9j0k1l2m3n4o5p6q7r8",
      "title": "JavaScript Fundamentals Quiz",
      "description": "Test your knowledge of JavaScript basics",
      "mode": "quiz",
      "isDispatched": true,
      "dispatchDate": "2024-01-16T09:00:00.000Z",
      "startDate": "2024-02-01T00:00:00.000Z",
      "dueDate": "2024-02-07T23:59:59.000Z",
      "questions": [
        {
          "_id": "64e5f6g7h8i9j0k1l2m3n4o5",
          "content": "What is a closure in JavaScript?",
          "type": "mcq"
        }
      ],
      "createdBy": {
        "_id": "64a7b8c9d0e1f2g3h4i5j6k7",
        "name": "Dr. Smith",
        "email": "smith@university.edu"
      },
      "submissions": []
    }
  ]
}
```

### Get Student's Assignments
```http
GET /assignments/me
```

**Authorization:** Student

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64h8i9j0k1l2m3n4o5p6q7r8",
      "title": "JavaScript Fundamentals Quiz",
      "startDate": "2024-02-01T00:00:00.000Z",
      "dueDate": "2024-02-07T23:59:59.000Z",
      "mode": "quiz",
      "timeLimitMinutes": 60,
      "visibleToAll": true,
      "createdBy": {
        "_id": "64a7b8c9d0e1f2g3h4i5j6k7",
        "name": "Dr. Smith"
      },
      "questionsCount": 10,
      "studentStatus": "pending",
      "mySubmission": null
    },
    {
      "_id": "64i9j0k1l2m3n4o5p6q7r8s9",
      "title": "Data Structures Assignment",
      "startDate": "2024-01-15T00:00:00.000Z",
      "dueDate": "2024-01-22T23:59:59.000Z",
      "mode": "assignment",
      "timeLimitMinutes": null,
      "visibleToAll": true,
      "createdBy": {
        "_id": "64a7b8c9d0e1f2g3h4i5j6k7",
        "name": "Dr. Smith"
      },
      "questionsCount": 5,
      "studentStatus": "completed",
      "mySubmission": {
        "_id": "64j0k1l2m3n4o5p6q7r8s9t0",
        "grade": 8,
        "submittedAt": "2024-01-20T14:30:00.000Z",
        "isFinal": true
      }
    }
  ]
}
```

**Student Status Values:**
- `upcoming`: Assignment start date is in the future
- `pending`: Can be attempted (between start and due date)
- `completed`: Final submission made
- `closed`: Due date passed, no submission
- `pendingReview`: Submitted but contains descriptive questions awaiting manual grading

### Get Single Assignment
```http
GET /assignments/:id
```

**URL Parameters:**
- `id` (ObjectId): Assignment ID

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "_id": "64h8i9j0k1l2m3n4o5p6q7r8",
    "title": "JavaScript Fundamentals Quiz",
    "description": "Test your knowledge of JavaScript basics",
    "mode": "quiz",
    "isDispatched": true,
    "dispatchDate": "2024-01-16T09:00:00.000Z",
    "questions": [
      {
        "_id": "64e5f6g7h8i9j0k1l2m3n4o5",
        "type": "mcq",
        "content": "What is a closure in JavaScript?",
        "options": [
          {"id": "A", "text": "A function that returns another function"},
          {"id": "B", "text": "A function that has access to outer scope"},
          {"id": "C", "text": "A function that is immediately invoked"},
          {"id": "D", "text": "A function without parameters"}
        ],
        "correctAnswers": ["B"],
        "explanation": "A closure gives you access to an outer function's scope from an inner function.",
        "tags": {
          "topics": ["javascript", "functions"],
          "difficulty": "intermediate",
          "creator": {
            "_id": "64a7b8c9d0e1f2g3h4i5j6k7",
            "name": "Dr. Smith",
            "email": "smith@university.edu"
          }
        }
      }
    ],
    "visibleTo": [
      {
        "_id": "64s1t2u3v4w5x6y7z8a9b0c1",
        "name": "John Doe",
        "email": "john@university.edu"
      }
    ],
    "createdBy": {
      "_id": "64a7b8c9d0e1f2g3h4i5j6k7",
      "name": "Dr. Smith",
      "email": "smith@university.edu"
    },
    "startDate": "2024-02-01T00:00:00.000Z",
    "dueDate": "2024-02-07T23:59:59.000Z",
    "timeLimitMinutes": 60,
    "submissions": [],
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-16T09:00:00.000Z"
  }
}
```

### Update Assignment
```http
PUT /assignments/:id
```

**Authorization:** Admin, Mentor

**URL Parameters:**
- `id` (ObjectId): Assignment ID

**Request Body (Partial Update):**
```json
{
  "title": "Updated: JavaScript Fundamentals Quiz",
  "description": "Updated description with more details",
  "dueDate": "2024-02-10T23:59:59.000Z",
  "timeLimitMinutes": 90
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "_id": "64h8i9j0k1l2m3n4o5p6q7r8",
    "title": "Updated: JavaScript Fundamentals Quiz",
    "description": "Updated description with more details",
    "dueDate": "2024-02-10T23:59:59.000Z",
    "timeLimitMinutes": 90,
    // ... other fields remain unchanged
  }
}
```

### Dispatch Assignment (Make Live)
```http
PUT /assignments/:id/dispatch
```

**Authorization:** Admin, Mentor

**URL Parameters:**
- `id` (ObjectId): Assignment ID

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "_id": "64h8i9j0k1l2m3n4o5p6q7r8",
    "isDispatched": true,
    "dispatchDate": "2024-01-16T09:00:00.000Z",
    // ... other fields
  }
}
```

### Undispatch Assignment (Revert to Draft)
```http
PUT /assignments/:id/undispatch
```

**Authorization:** Admin, Mentor

**URL Parameters:**
- `id` (ObjectId): Assignment ID

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "_id": "64h8i9j0k1l2m3n4o5p6q7r8",
    "isDispatched": false,
    "dispatchDate": null,
    // ... other fields
  }
}
```

### Delete Assignment
```http
DELETE /assignments/:id
```

**Authorization:** Admin, Mentor

**URL Parameters:**
- `id` (ObjectId): Assignment ID

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Deleted"
}
```

### Get Assignment Rankings
```http
GET /assignments/:id/rankings
```

**Authorization:** Admin, Mentor

**URL Parameters:**
- `id` (ObjectId): Assignment ID

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "student": "Alice Johnson",
      "grade": 10,
      "rank": 1
    },
    {
      "student": "Bob Smith",
      "grade": 9,
      "rank": 2
    },
    {
      "student": "Charlie Brown",
      "grade": 9,
      "rank": 2
    },
    {
      "student": "Diana Prince",
      "grade": 8,
      "rank": 4
    }
  ]
}
```

---

## Submission System

**All routes require authentication. Admin/Mentor authorization specified per endpoint.**

### Submit Assignment
```http
POST /assignments/:id/submit
```

**Authorization:** Student

**URL Parameters:**
- `id` (ObjectId): Assignment ID

**Request Body:**
```json
{
  "answers": [
    {
      "question": "64e5f6g7h8i9j0k1l2m3n4o5",
      "response": "B"
    },
    {
      "question": "64f6g7h8i9j0k1l2m3n4o5p6",
      "response": ["A", "C"]
    },
    {
      "question": "64g7h8i9j0k1l2m3n4o5p6q7",
      "response": "A closure in JavaScript is a function that retains access to variables from its outer scope even after the outer function has returned."
    }
  ],
  "testCaseResults": [],
  "isFinal": true,
  "timeTakenMs": 1800000
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "_id": "64i9j0k1l2m3n4o5p6q7r8s9",
    "assignment": "64h8i9j0k1l2m3n4o5p6q7r8",
    "student": "64s1t2u3v4w5x6y7z8a9b0c1",
    "answers": [
      {
        "question": "64e5f6g7h8i9j0k1l2m3n4o5",
        "response": "B"
      },
      {
        "question": "64f6g7h8i9j0k1l2m3n4o5p6",
        "response": ["A", "C"]
      },
      {
        "question": "64g7h8i9j0k1l2m3n4o5p6q7",
        "response": "A closure in JavaScript is a function that retains access to variables from its outer scope even after the outer function has returned."
      }
    ],
    "grade": 7,
    "feedback": null,
    "isFinal": true,
    "timeTakenMs": 1800000,
    "submittedAt": "2024-01-20T14:30:00.000Z"
  }
}
```

### Get Student's Own Submission
```http
GET /assignments/:id/submission
```

**Authorization:** Student

**URL Parameters:**
- `id` (ObjectId): Assignment ID

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "_id": "64i9j0k1l2m3n4o5p6q7r8s9",
    "assignment": "64h8i9j0k1l2m3n4o5p6q7r8",
    "student": "64s1t2u3v4w5x6y7z8a9b0c1",
    "answers": [...],
    "grade": 7,
    "feedback": "Good work overall. Consider reviewing the closure concept.",
    "isFinal": true,
    "timeTakenMs": 1800000,
    "submittedAt": "2024-01-20T14:30:00.000Z"
  }
}
```

**Response (404 Not Found):**
```json
{
  "success": false,
  "message": "No submission found"
}
```

### Get All Submissions for Assignment
```http
GET /assignments/:id/submissions
```

**Authorization:** Admin, Mentor

**URL Parameters:**
- `id` (ObjectId): Assignment ID

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64i9j0k1l2m3n4o5p6q7r8s9",
      "student": {
        "_id": "64s1t2u3v4w5x6y7z8a9b0c1",
        "name": "John Doe",
        "email": "john@university.edu"
      },
      "answers": [
        {
          "question": "64e5f6g7h8i9j0k1l2m3n4o5",
          "response": "B"
        }
      ],
      "grade": 7,
      "feedback": null,
      "isFinal": true,
      "submittedAt": "2024-01-20T14:30:00.000Z"
    }
  ]
}
```

### Get Specific Student's Submission
```http
GET /assignments/:id/submissions/:studentId
```

**Authorization:** Admin, Mentor

**URL Parameters:**
- `id` (ObjectId): Assignment ID
- `studentId` (ObjectId): Student ID

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "_id": "64i9j0k1l2m3n4o5p6q7r8s9",
    "student": {
      "_id": "64s1t2u3v4w5x6y7z8a9b0c1",
      "name": "John Doe",
      "email": "john@university.edu"
    },
    "assignment": "64h8i9j0k1l2m3n4o5p6q7r8",
    "answers": [
      {
        "question": "64e5f6g7h8i9j0k1l2m3n4o5",
        "response": "B"
      }
    ],
    "grade": 7,
    "feedback": "Good work overall. Consider reviewing the closure concept.",
    "isFinal": true,
    "submittedAt": "2024-01-20T14:30:00.000Z"
  }
}
```

### Grade Student Submission
```http
PUT /assignments/:id/submissions/:studentId
```

**Authorization:** Admin, Mentor

**URL Parameters:**
- `id` (ObjectId): Assignment ID
- `studentId` (ObjectId): Student ID

**Request Body:**
```json
{
  "grade": 8,
  "feedback": "Good work overall. Consider reviewing the closure concept for better understanding.",
  "answers": [
    {
      "question": "64g7h8i9j0k1l2m3n4o5p6q7",
      "isCorrect": true
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "_id": "64i9j0k1l2m3n4o5p6q7r8s9",
    "student": "64s1t2u3v4w5x6y7z8a9b0c1",
    "assignment": "64h8i9j0k1l2m3n4o5p6q7r8",
    "answers": [
      {
        "question": "64e5f6g7h8i9j0k1l2m3n4o5",
        "response": "B",
        "isCorrect": true
      },
      {
        "question": "64g7h8i9j0k1l2m3n4o5p6q7",
        "response": "A closure in JavaScript...",
        "isCorrect": true
      }
    ],
    "grade": 8,
    "feedback": "Good work overall. Consider reviewing the closure concept for better understanding.",
    "isFinal": true,
    "submittedAt": "2024-01-20T14:30:00.000Z"
  }
}
```

---

## Code Execution

**Rate Limited: 50 requests per 15 minutes per IP**

### Test Code with Custom Input
```http
POST /code-exec/test
```

**Request Body:**
```json
{
  "language": "python",
  "code": "num = int(input())\nprint(num * 2)",
  "input": "5"
}
```

**Response (200 OK - Success):**
```json
{
  "success": true,
  "data": {
    "output": "10\n",
    "error": "",
    "success": true,
    "executionTime": 45,
    "fromCache": false
  }
}
```

**Response (200 OK - Runtime Error):**
```json
{
  "success": true,
  "data": {
    "output": "",
    "error": "NameError: name 'x' is not defined",
    "success": false,
    "executionTime": 20,
    "fromCache": false
  }
}
```

**Response (400 Bad Request):**
```json
{
  "success": false,
  "message": "Unsupported language: ruby"
}
```

### Execute Code with Test Cases
```http
POST /code-exec/run
```

**Request Body:**
```json
{
  "language": "python",
  "code": "num = int(input())\nprint(str(num)[::-1])",
  "testCases": [
    {"input": "1234", "expected": "4321"},
    {"input": "567", "expected": "765"},
    {"input": "1000", "expected": "0001"}
  ]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "passedTestCases": 2,
    "totalTestCases": 3,
    "score": 67,
    "testResults": [
      {
        "testCase": 1,
        "input": "1234",
        "expectedOutput": "4321",
        "actualOutput": "4321",
        "passed": true,
        "error": null,
        "stderr": "",
        "executionTime": 42
      },
      {
        "testCase": 2,
        "input": "567",
        "expectedOutput": "765",
        "actualOutput": "765",
        "passed": true,
        "error": null,
        "stderr": "",
        "executionTime": 38
      },
      {
        "testCase": 3,
        "input": "1000",
        "expectedOutput": "0001",
        "actualOutput": "1",
        "passed": false,
        "error": null,
        "stderr": "",
        "executionTime": 35
      }
    ],
    "metadata": {
      "language": "python",
      "totalExecutionTime": 115,
      "timestamp": "2024-01-20T14:30:00.000Z",
      "pistonVersion": "latest"
    }
  }
}
```

### Service Health Check
```http
GET /code-exec/health
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "languageCount": 5,
    "url": "http://localhost:2000/api/v2",
    "cache": {
      "size": 245,
      "maxSize": 1000,
      "hitRate": 0.73,
      "hits": 1830,
      "misses": 674
    },
    "uptime": 86400,
    "memory": {
      "rss": 52428800,
      "heapTotal": 41943040,
      "heapUsed": 28651392,
      "external": 1089536
    },
    "timestamp": "2024-01-20T14:30:00.000Z"
  }
}
```

### Get Supported Languages
```http
GET /code-exec/languages
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "supported": ["python", "javascript", "java", "cpp", "c"],
    "total": 5,
    "languages": [
      {
        "language": "python",
        "version": "3.12.0",
        "aliases": ["py", "python3"]
      },
      {
        "language": "javascript",
        "version": "20.11.1",
        "aliases": ["js", "node"]
      },
      {
        "language": "java",
        "version": "15.0.2",
        "aliases": ["java"]
      },
      {
        "language": "cpp",
        "version": "10.2.0",
        "aliases": ["c++"]
      },
      {
        "language": "c",
        "version": "10.2.0",
        "aliases": ["c"]
      }
    ],
    "timestamp": "2024-01-20T14:30:00.000Z"
  }
}
```

### Cache Statistics (Admin)
```http
GET /code-exec/cache/stats
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "size": 245,
    "maxSize": 1000,
    "hitRate": 0.73,
    "hits": 1830,
    "misses": 674
  }
}
```

### Clear Cache (Admin)
```http
DELETE /code-exec/cache
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Cache cleared successfully"
}
```

---

## Code Submission System

**All routes require authentication. Admin/Mentor authorization specified per endpoint.**

### Submit Code for Grading
```http
POST /code-submissions
```

**Request Body:**
```json
{
  "assignmentId": "64h8i9j0k1l2m3n4o5p6q7r8",
  "questionId": "64e5f6g7h8i9j0k1l2m3n4o5",
  "code": "def reverse_number(num):\n    return int(str(num)[::-1])\n\nnum = int(input())\nprint(reverse_number(num))",
  "language": "python"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "submissionId": "64j0k1l2m3n4o5p6q7r8s9t0",
    "score": 85,
    "passedTestCases": 4,
    "totalTestCases": 5,
    "testResults": [
      {
        "input": "1234",
        "expectedOutput": "4321",
        "actualOutput": "4321",
        "status": "passed",
        "executionTime": 42
      },
      {
        "input": "567",
        "expectedOutput": "765",
        "actualOutput": "765",
        "status": "passed",
        "executionTime": 38
      },
      {
        "input": "1000",
        "expectedOutput": "0001",
        "actualOutput": "1",
        "status": "failed",
        "executionTime": 35
      }
    ],
    "submittedAt": "2024-01-20T14:30:00.000Z",
    "codeMetrics": {
      "linesOfCode": 4,
      "complexity": 2,
      "hasComments": false,
      "hasFunctions": true
    }
  }
}
```

### Save Code Draft
```http
POST /code-submissions/draft
```

**Request Body:**
```json
{
  "assignmentId": "64h8i9j0k1l2m3n4o5p6q7r8",
  "questionId": "64e5f6g7h8i9j0k1l2m3n4o5",
  "code": "def reverse_number(num):\n    # Work in progress\n    pass",
  "language": "python"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Draft saved successfully",
  "data": {
    "draftId": "64k1l2m3n4o5p6q7r8s9t0u1",
    "savedAt": "2024-01-20T14:30:00.000Z"
  }
}
```

### Get Code Submissions
```http
GET /code-submissions?assignmentId=64h8i9j0k1l2m3n4o5p6q7r8&questionId=64e5f6g7h8i9j0k1l2m3n4o5&includeDrafts=false
```

**Query Parameters:**
- `assignmentId` (ObjectId, optional): Filter by assignment
- `questionId` (ObjectId, optional): Filter by question
- `student` (ObjectId, optional): Filter by student (admin/mentor only)
- `includeDrafts` (boolean, optional): Include draft submissions (default: false)

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64j0k1l2m3n4o5p6q7r8s9t0",
      "student": {
        "_id": "64s1t2u3v4w5x6y7z8a9b0c1",
        "name": "John Doe",
        "email": "john@university.edu"
      },
      "assignment": {
        "_id": "64h8i9j0k1l2m3n4o5p6q7r8",
        "title": "Coding Assignment 1"
      },
      "question": {
        "_id": "64e5f6g7h8i9j0k1l2m3n4o5",
        "content": "Write a function to reverse a number",
        "type": "coding"
      },
      "code": "def reverse_number(num):\n    return int(str(num)[::-1])",
      "language": "python",
      "isDraft": false,
      "status": "graded",
      "score": 85,
      "passedTestCases": 4,
      "totalTestCases": 5,
      "testResults": [...],
      "codeMetrics": {
        "linesOfCode": 4,
        "complexity": 2,
        "hasComments": false,
        "hasFunctions": true
      },
      "submittedAt": "2024-01-20T14:30:00.000Z"
    }
  ]
}
```

### Grade Code Submission (Instructor)
```http
PUT /code-submissions/:submissionId/grade
```

**Authorization:** Admin, Mentor

**URL Parameters:**
- `submissionId` (ObjectId): Code submission ID

**Request Body:**
```json
{
  "score": 90,
  "feedback": "Excellent solution! Well-structured code with good variable naming. Consider adding error handling for edge cases like negative numbers."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Submission graded successfully",
  "data": {
    "_id": "64j0k1l2m3n4o5p6q7r8s9t0",
    "student": {
      "_id": "64s1t2u3v4w5x6y7z8a9b0c1",
      "name": "John Doe",
      "email": "john@university.edu"
    },
    "code": "def reverse_number(num):\n    return int(str(num)[::-1])",
    "language": "python",
    "score": 90,
    "manualGrade": {
      "score": 90,
      "feedback": "Excellent solution! Well-structured code with good variable naming. Consider adding error handling for edge cases like negative numbers.",
      "gradedBy": {
        "_id": "64a7b8c9d0e1f2g3h4i5j6k7",
        "name": "Dr. Smith",
        "email": "smith@university.edu"
      },
      "gradedAt": "2024-01-20T15:00:00.000Z"
    },
    "status": "graded"
  }
}
```

### Get Submissions for Grading Queue
```http
GET /code-submissions/grading?assignmentId=64h8i9j0k1l2m3n4o5p6q7r8&questionId=64e5f6g7h8i9j0k1l2m3n4o5
```

**Authorization:** Admin, Mentor

**Query Parameters:**
- `assignmentId` (ObjectId, optional): Filter by assignment
- `questionId` (ObjectId, optional): Filter by question

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64j0k1l2m3n4o5p6q7r8s9t0",
      "student": {
        "name": "John Doe",
        "email": "john@university.edu"
      },
      "question": {
        "content": "Write a function to reverse a number"
      },
      "code": "def reverse_number(num):\n    return int(str(num)[::-1])",
      "language": "python",
      "score": 85,
      "passedTestCases": 4,
      "totalTestCases": 5,
      "submittedAt": "2024-01-20T14:30:00.000Z"
    }
  ]
}
```

---

## Statistics & Analytics

**All routes require authentication and Admin/Mentor authorization.**

### Basic Statistics Overview
```http
GET /stats
```

**Authorization:** Admin, Mentor

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "totalStudents": 156,
    "totalMentors": 8,
    "totalAssignments": 23,
    "totalQuizzes": 15,
    "totalTests": 7,
    "totalQuestions": 245,
    "ongoingAssignments": 5,
    "ongoingQuizzes": 2,
    "ongoingTests": 1,
    "totalSubs": 892,
    "pendingReview": 34
  }
}
```

### Advanced Dashboard Statistics
```http
GET /stats/dashboard
```

**Authorization:** Admin, Mentor

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "totalStudents": 156,
    "totalAssignments": 23,
    "totalQuizzes": 15,
    "totalTests": 7,
    "totalQuestions": 245,
    "mcqCount": 98,
    "msqCount": 67,
    "descriptiveCount": 56,
    "imageCount": 24,
    "dispatched": [
      {
        "_id": "quiz",
        "dispatched": 12,
        "drafts": 3
      },
      {
        "_id": "assignment",
        "dispatched": 18,
        "drafts": 5
      },
      {
        "_id": "test",
        "dispatched": 6,
        "drafts": 1
      }
    ],
    "leaderboard": [
      {
        "_id": "64d4e5f6g7h8i9j0k1l2m3n4",
        "title": "JavaScript Advanced Quiz",
        "leaderboard": [
          {
            "student": {
              "_id": "64a7b8c9d0e1f2g3h4i5j6k7",
              "name": "Alice Johnson",
              "email": "alice@university.edu"
            },
            "grade": 10
          },
          {
            "student": {
              "_id": "64b8c9d0e1f2g3h4i5j6k7l8",
              "name": "Bob Smith",
              "email": "bob@university.edu"
            },
            "grade": 9
          }
        ]
      }
    ]
  }
}
```

---

## File Upload

**All routes require authentication.**

### Upload Image for Questions
```http
POST /upload/image
```

**Content-Type:** `multipart/form-data`

**Form Data:**
- `file` (File): Image file (JPEG, PNG, etc.)

**Response (200 OK):**
```json
{
  "success": true,
  "url": "https://res.cloudinary.com/techsociety/image/upload/v1705315800/questions/abc123def456.jpg"
}
```

**Response (400 Bad Request):**
```json
{
  "success": false,
  "message": "No file uploaded"
}
```

---

## Data Models Reference

### User Model Structure
```javascript
{
  _id: ObjectId,
  name: String,
  email: String (unique),
  password: String (bcrypt hashed),
  role: "student" | "mentor" | "admin",
  branch: String,
  year: String,
  isVerified: Boolean,
  verifyToken: String,
  verifyTokenExpiry: Date,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Question Model Structure
```javascript
{
  _id: ObjectId,
  type: "mcq" | "msq" | "descriptive" | "image" | "coding",
  content: String (HTML supported),
  images: [{ url: String, caption: String }],
  options: [{ id: String, text: String }], // For MCQ/MSQ
  correctAnswers: [String],
  testCases: [{ input: String, expected: String, weight: Number }], // For coding
  explanation: String,
  tags: {
    topics: [String],
    difficulty: "beginner" | "intermediate" | "advanced",
    creator: ObjectId -> User
  },
  usageCount: Number,
  lastUsedAt: Date,
  lastUsedIn: ObjectId -> Assignment,
  
  // Coding Question Fields
  isCodingQuestion: Boolean,
  platform: "internal" | "judge0",
  autoGraded: Boolean,
  platformConfig: {
    allowedLanguages: [String],
    timeLimit: Number,
    memoryLimit: Number,
    gradingType: "all-or-nothing" | "partial" | "weighted",
    starterCode: { [language]: String },
    solutionCode: { [language]: String }
  },
  
  createdAt: Date,
  updatedAt: Date
}
```

### Assignment Model Structure
```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  mode: "assignment" | "quiz" | "test",
  isDispatched: Boolean,
  dispatchDate: Date,
  startDate: Date,
  dueDate: Date,
  timeLimitMinutes: Number,
  questions: [ObjectId -> Question],
  visibleToAll: Boolean,
  visibleTo: [ObjectId -> User],
  createdBy: ObjectId -> User,
  submissions: [{ // Embedded submissions
    student: ObjectId -> User,
    answers: [{
      question: ObjectId -> Question,
      response: Mixed, // String or [String]
      isCorrect: Boolean
    }],
    submittedAt: Date,
    grade: Number,
    feedback: String
  }],
  createdAt: Date,
  updatedAt: Date
}
```

### Submission Model Structure
```javascript
{
  _id: ObjectId,
  assignment: ObjectId -> Assignment,
  student: ObjectId -> User,
  answers: [{
    question: ObjectId -> Question,
    response: Mixed // String for MCQ, [String] for MSQ, String for descriptive
  }],
  testCaseResults: [{ input: String, output: String }],
  grade: Number,
  feedback: String,
  isFinal: Boolean,
  timeTakenMs: Number,
  submittedAt: Date
}
```

### CodeSubmission Model Structure
```javascript
{
  _id: ObjectId,
  student: ObjectId -> User,
  assignment: ObjectId -> Assignment,
  question: ObjectId -> Question,
  code: String,
  language: String,
  isDraft: Boolean,
  submittedAt: Date,
  status: "pending" | "grading" | "graded" | "error",
  
  testResults: [{
    input: String,
    expectedOutput: String,
    actualOutput: String,
    status: "passed" | "failed" | "error" | "pending",
    executionTime: Number,
    memory: Number,
    weight: Number
  }],
  
  score: Number (0-100),
  totalTestCases: Number,
  passedTestCases: Number,
  
  manualGrade: {
    score: Number,
    feedback: String,
    gradedBy: ObjectId -> User,
    gradedAt: Date
  },
  
  executionResult: {
    output: String,
    error: String,
    executionTime: Number,
    memory: Number
  },
  
  codeMetrics: {
    linesOfCode: Number,
    complexity: Number,
    hasComments: Boolean,
    hasFunctions: Boolean
  },
  
  createdAt: Date,
  updatedAt: Date
}
```

---

## Error Handling

### Standard Response Format

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "User-friendly error message",
  "error": "Technical details (development mode only)"
}
```

### Common HTTP Status Codes

- **200 OK**: Request succeeded
- **201 Created**: Resource created successfully
- **400 Bad Request**: Invalid request data
- **401 Unauthorized**: Authentication required or invalid token
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error

### Error Response Examples

**400 Bad Request:**
```json
{
  "success": false,
  "message": "Code cannot be empty"
}
```

**401 Unauthorized:**
```json
{
  "success": false,
  "message": "No token provided"
}
```

**403 Forbidden:**
```json
{
  "success": false,
  "message": "Forbidden: insufficient rights"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "message": "Assignment not found"
}
```

**429 Too Many Requests:**
```json
{
  "success": false,
  "message": "Too many code execution requests. Please try again later."
}
```

### Validation Errors

**Question Creation Validation:**
```json
{
  "success": false,
  "message": "MCQ questions must have at least two non-empty options"
}
```

**Code Execution Validation:**
```json
{
  "success": false,
  "message": "Unsupported language: ruby"
}
```

**Assignment Submission Validation:**
```json
{
  "success": false,
  "message": "Assignment deadline has passed"
}
```

---

## Rate Limiting

### Global Rate Limit
- **Window**: 1 minute
- **Limit**: 100 requests per IP
- **Scope**: All API endpoints

### Code Execution Rate Limit
- **Window**: 15 minutes  
- **Limit**: 50 requests per IP
- **Scope**: `/code-exec/*` endpoints
- **Bypass**: Development environment

### Rate Limit Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642685400
```

### Rate Limit Response
```json
{
  "success": false,
  "message": "Too many requests from this IP, please try again later."
}
```

---

## Authentication Headers

All protected routes require the JWT token in the Authorization header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY0YTdiOGM5ZDBlMWYyZzNoNGk1ajZrNyIsImlhdCI6MTY0MjY4NTQwMCwiZXhwIjoxNjQzMjkwMjAwfQ.xyz123...
```

## Inter-Model Relationships

### Data Flow Diagrams

**Assignment Creation Flow:**
```
Question Selection → Assignment Creation → Usage Tracking → Statistics Update
```

**Student Submission Flow:**
```
Assignment Attempt → Answer Collection → Auto-grading → Manual Review → Final Grade
```

**Code Execution Flow:**
```
Code Submission → Validation → Piston API → Test Cases → Results → Caching
```

**User Authentication Flow:**
```
Login Request → JWT Generation → Token Storage → Request Authorization → Access Control
```

---

*API Reference Version 1.0*  
*Complete Endpoint Documentation*  
*Last Updated: Full Backend API Coverage*