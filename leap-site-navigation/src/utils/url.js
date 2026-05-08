// Check if input is a URL
export function isURL(input) {
	try {
		new URL(input);
		return true;
	} catch {
		if (input.includes('.') && !input.includes(' ')) {
			try {
				new URL(`https://${input}`);
				return true;
			} catch {
				return false;
			}
		}
		return false;
	}
}

// Normalize URL to proper format
export function normalizeURL(input) {
	if (input.startsWith('http://') || input.startsWith('https://')) {
		return input;
	}
	return `https://${input}`;
}

// Normalize a URL for comparison: strip query params and trailing slashes.
// Used to detect duplicate URLs regardless of minor formatting differences.
export function normalizeForUrlComparison(rawUrl) {
	if (!rawUrl || typeof rawUrl !== 'string') return null;
	try {
		const u = new URL(rawUrl);
		return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
	} catch {
		return rawUrl.replace(/\/+$/, '');
	}
}

// Remove query parameters from URL
export function stripQueryParams(urlString) {
	try {
		const url = new URL(urlString);
		return `${url.origin}${url.pathname}`;
	} catch {
		return urlString;
	}
}

// Check if URL has been visited frequently
export function hasFrequentVisits(visitTimestamps) {
	if (!visitTimestamps || visitTimestamps.length === 0) {
		return false;
	}

	const now = Date.now();
	const thirtyMinutes = 30 * 60 * 1000;
	const oneHour = 60 * 60 * 1000;
	const twentyFourHours = 24 * 60 * 60 * 1000;

	const recentVisits = visitTimestamps.filter((timestamp) => now - timestamp <= thirtyMinutes);
	if (recentVisits.length >= 3) {
		return true;
	}

	const hourlyVisits = visitTimestamps.filter((timestamp) => now - timestamp <= oneHour);
	if (hourlyVisits.length >= 4) {
		return true;
	}

	const dailyVisits = visitTimestamps.filter((timestamp) => now - timestamp <= twentyFourHours);
	if (dailyVisits.length >= 6) {
		return true;
	}

	return false;
}

// Convert a tab title to suggestion fields (keyword + description).
// Falls back to extractSuggestionFields() when the title is empty.
export function extractSuggestionFieldsFromTitle(tabTitle, urlString) {
	const urlWithoutParams = stripQueryParams(urlString);

	if (!tabTitle || !tabTitle.trim()) {
		return extractSuggestionFields(urlString);
	}

	const trimmedTitle = tabTitle.trim();

	// Build kebab-case keyword: lower-case, keep only ASCII letters/numbers and spaces,
	// then collapse runs of whitespace into single hyphens.
	// ASCII-only is required so the keyword round-trips safely through lp/<keyword> URL paths
	// without percent-encoding mismatches.
	const keyword = trimmedTitle
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, ' ')
		.trim()
		.replace(/\s+/g, '-')
		.replace(/^-+|-+$/g, '');

	if (!keyword) {
		return extractSuggestionFields(urlString);
	}

	const description = `Open ${trimmedTitle}`;

	return { url: urlWithoutParams, keyword, description, originalUrl: urlString };
}

// Function to extract suggestion fields from a URL
export function extractSuggestionFields(urlString) {
	try {
		const url = new URL(urlString);
		let hostname = url.hostname;

		hostname = hostname.replace(/^www\./, '');

		const parts = hostname.split('.');

		let keyword, capitalizedName;

		if (parts.length >= 3) {
			const subdomain = parts[0];
			const domain = parts[1];

			keyword = `${subdomain}-${domain}`.toLowerCase();

			const capitalizedSubdomain = subdomain.charAt(0).toUpperCase() + subdomain.slice(1);
			const capitalizedDomain = domain.charAt(0).toUpperCase() + domain.slice(1);
			capitalizedName = `${capitalizedDomain} ${capitalizedSubdomain}`;
		} else {
			keyword = parts[0].toLowerCase();
			capitalizedName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
		}

		const description = `Open ${capitalizedName}`;
		const urlWithoutParams = stripQueryParams(urlString);

		return { url: urlWithoutParams, keyword, description, originalUrl: urlString };
	} catch (error) {
		console.error('Error parsing URL:', error);
		return { url: urlString, keyword: '', description: '' };
	}
}
