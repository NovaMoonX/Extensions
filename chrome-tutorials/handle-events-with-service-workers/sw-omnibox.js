console.log("sw-omnibox.js");

const defaultSuggestions = ['notes', 'mnemo', 'akyl', 'planner', 'tinies', 'github']

const SUGGESTIONS_MAP = {
  notes: {
    url: 'https://tinies.moondreams.dev/notes',
    description: 'Open notes in Tinies,'
  },
  mnemo: {
    url: 'https://mnemo-ba644.web.app/',
    description: 'Open Mnemo,'
  },
  akyl: {
    url: 'https://akyl.moondreams.dev/',
    description: 'Open Akyl, Better Visualize Your Budget'
  },
  planner: {
    url: 'https://planner.moondreams.dev/',
    description: 'Open Odysseus Planner'
  },
  tinies: {
    url: 'https://tinies.moondreams.dev',
    description: 'Open Tinies, Collection of Prototypes and Experiments'
  },
  github: {
    url: 'https://github.com/NovaMoonX',
    description: 'Open GitHub profile'
  }
};

const URL_GOOGLE_SEARCH =
  'https://www.google.com/search?q=';
const NUMBER_OF_PREVIOUS_SEARCHES = 5;

async function updateHistory(input) {
  const { apiSuggestions } = await chrome.storage.local.get('apiSuggestions');
  apiSuggestions.unshift(input);
  apiSuggestions.splice(NUMBER_OF_PREVIOUS_SEARCHES);
  return chrome.storage.local.set({ apiSuggestions });
}

// Save default API suggestions
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.storage.local.set({
      apiSuggestions: defaultSuggestions
    });
  }
});

// Display the suggestions after user starts typing, following the keyword "MDD"
chrome.omnibox.onInputChanged.addListener(async (input, suggest) => {
  await chrome.omnibox.setDefaultSuggestion({
    description: 'Enter a new resource or choose from existing options'
  });
  const { apiSuggestions } = await chrome.storage.local.get('apiSuggestions');
  const suggestions = (apiSuggestions || defaultSuggestions).map((api) => {
    return { content: api, description: SUGGESTIONS_MAP[api]?.description || api };
  });
  suggest(suggestions);
});

// Called after user accepts an options - Open the page of the chosen resource
chrome.omnibox.onInputEntered.addListener((input) => {
  const url = SUGGESTIONS_MAP[input]?.url || `${URL_GOOGLE_SEARCH}${input}`;
  chrome.tabs.create({ url });
  // Save the latest keyword
  updateHistory(input);
});