# New England Jobs - Job Search Aggregator

A static website that aggregates job listings from multiple sources, focusing on New England-based positions and remote opportunities. Built with vanilla JavaScript and deployed via GitHub Pages.

## Features

- **Multi-category search**: Find remote, hybrid, and on-site jobs across New England
- **Smart filtering**: Filter by job category, state, date posted, salary, and job type
- **Relevance scoring**: Jobs are scored and ranked based on keyword matching
- **Job alerts**: Create custom alerts with keyword and preference matching
- **Save jobs**: Bookmark jobs with notes, export as JSON or CSV
- **Responsive design**: Works on mobile, tablet, and desktop
- **Accessible**: Keyboard navigation, ARIA labels, and screen reader support

## Job Categories

| Category | Description | Color |
|----------|-------------|-------|
| Remote | Fully remote, work from anywhere | Green |
| Remote (US) | Remote, available to US workers | Blue |
| Hybrid (NE) | Hybrid with New England office | Orange |
| On-site (NE) | On-site in CT, MA, ME, NH, RI, or VT | Indigo |
| Remote (NE Co.) | Remote from NE-based companies | Purple |

## Setup

### 1. Get an API Key

1. Go to [JSearch on RapidAPI](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch)
2. Sign up for a free account
3. Subscribe to the JSearch API (free tier available)
4. Copy your API key

### 2. Configure the API Key

**Option A: Enter in browser (recommended)**
- Open the site and enter your API key in the banner prompt
- The key is saved in your browser's localStorage

**Option B: Edit config file**
1. Open `js/config.js`
2. Replace the empty string in `RAPID_API_KEY` with your key

### 3. Run Locally

Simply open `index.html` in your browser. No build tools or server required.

### 4. Deploy to GitHub Pages

1. Push code to your GitHub repository
2. Go to Settings > Pages
3. Select source: main branch, / (root) folder
4. Your site will be at: `https://<username>.github.io/<repo-name>/new-england-jobs/`

## File Structure

```
new-england-jobs/
├── index.html              # Main search page
├── saved-jobs.html         # Saved jobs page
├── alerts.html             # Job alerts management
├── css/
│   ├── styles.css          # Main styles and layout
│   ├── components.css      # Component-specific styles
│   └── responsive.css      # Mobile/tablet responsive styles
├── js/
│   ├── config.js           # API keys and configuration
│   ├── utils.js            # Helper functions
│   ├── api.js              # API integration with JSearch
│   ├── filters.js          # Location filtering and relevance scoring
│   ├── ui.js               # DOM manipulation and rendering
│   ├── alerts.js           # Job alert system
│   ├── saved-jobs.js       # Saved jobs management
│   └── app.js              # Main app initialization
├── assets/
│   ├── images/             # Default logos and images
│   └── icons/              # Favicon
├── config-template.js      # API key configuration template
├── .gitignore
└── README.md
```

## API Usage

This app uses the [JSearch API](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch) from RapidAPI.

- **Free tier**: ~250-500 requests/month
- **Rate limiting**: Client-side limit of 10 requests per minute
- **Caching**: API responses cached in sessionStorage for 5 minutes

### Security Note

API keys in client-side code are visible to anyone who inspects the source. Use free-tier keys only. For production deployments with sensitive keys, implement a serverless backend (Cloudflare Workers, Netlify Functions, etc.).

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## License

MIT
