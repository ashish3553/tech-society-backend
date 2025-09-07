const ArticleCategory = require('../models/ArticleCategory');
const User = require('../models/User'); // Adjust path as needed

const defaultCategories = [
  {
    name: 'Programming Fundamentals',
    description: 'Basic programming concepts, syntax, and problem-solving',
    color: '#3b82f6',
    icon: 'code',
    sortOrder: 1
  },
  {
    name: 'Data Structures & Algorithms',
    description: 'Arrays, trees, graphs, sorting, searching algorithms',
    color: '#8b5cf6',
    icon: 'database',
    sortOrder: 2
  },
  {
    name: 'Web Development',
    description: 'HTML, CSS, JavaScript, React, Node.js, full-stack development',
    color: '#06b6d4',
    icon: 'globe',
    sortOrder: 3
  },
  {
    name: 'Database Design',
    description: 'SQL, NoSQL, database modeling, optimization',
    color: '#84cc16',
    icon: 'server',
    sortOrder: 4
  },
  {
    name: 'Software Engineering',
    description: 'Design patterns, architecture, testing, best practices',
    color: '#f59e0b',
    icon: 'cog',
    sortOrder: 5
  },
  {
    name: 'Mobile Development',
    description: 'iOS, Android, React Native, Flutter development',
    color: '#ef4444',
    icon: 'smartphone',
    sortOrder: 6
  },
  {
    name: 'DevOps & Cloud',
    description: 'Docker, AWS, CI/CD, deployment, cloud architecture',
    color: '#6366f1',
    icon: 'cloud',
    sortOrder: 7
  },
  {
    name: 'Machine Learning & AI',
    description: 'ML algorithms, neural networks, data science, AI applications',
    color: '#ec4899',
    icon: 'brain',
    sortOrder: 8
  }
];

async function seedCategories() {
  try {
    // Check if categories already exist
    const existingCount = await ArticleCategory.countDocuments();
    if (existingCount > 0) {
      console.log('Categories already exist, skipping seed');
      return;
    }

    // Find a mentor or admin to assign as creator
    const mentor = await User.findOne({ 
      role: { $in: ['admin', 'mentor'] } 
    });

    if (!mentor) {
      console.log('No mentor found, cannot seed categories');
      return;
    }

    // Create categories
    const categories = await Promise.all(
      defaultCategories.map(categoryData => 
        ArticleCategory.create({
          ...categoryData,
          createdBy: mentor._id
        })
      )
    );

    console.log(`Created ${categories.length} default categories`);
    return categories;
  } catch (error) {
    console.error('Error seeding categories:', error);
  }
}

module.exports = { seedCategories };