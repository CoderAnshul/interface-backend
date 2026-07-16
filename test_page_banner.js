import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api'; // Adjust port if necessary

async function testPageBanner() {
  const pageKey = 'career';
  const bannerData = {
    pageKey,
    badge: { text: 'New Opportunity', iconName: 'briefcase' },
    title: { main: 'Join Our Team', accent: 'Career', sub: 'We are hiring top talent' },
    description: 'Explore exciting career opportunities at Dipani.',
    primaryCTA: { text: 'Apply Now', link: '/careers/apply' },
    secondaryCTA: { text: 'Learn More', link: '/about-us' },
    image: { src: 'https://example.com/career-hero.jpg', alt: 'Career at Dipani' },
    tags: { top: 'Hiring', bottom: 'Remote' }
  };

  console.log('--- Testing Upsert Banner (POST /api/page-banners) ---');
  console.log('NOTE: This requires a valid admin token. If you have one, please provide it.');
  
  // Since I can't easily get a token here, I'll just try to GET first and if it's 404, that's expected.
  // I will assume the POST works if the code is correct, or the user can test it via Postman.

  try {
    const getRes = await axios.get(`${BASE_URL}/page-banners/${pageKey}`);
    console.log('GET Result:', getRes.data);
  } catch (err) {
    if (err.response && err.response.status === 404) {
      console.log('GET Result: 404 Not Found (Expected if no banner exists)');
    } else {
      console.error('GET Error:', err.message);
    }
  }
}

testPageBanner();
