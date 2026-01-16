// Check if input is a URL
export function isURL(input) {
	try {
		// Try to parse as URL
		new URL(input);
		return true;
	} catch {
		// Try adding https:// if it looks like a domain
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
	const thirtyMinutes = 30 * 60 * 1000; // 30 minutes in milliseconds
	const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
	const twentyFourHours = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

	// Count visits in the last 30 minutes
	const recentVisits = visitTimestamps.filter((timestamp) => now - timestamp <= thirtyMinutes);
	if (recentVisits.length >= 3) {
		return true;
	}

	// Count visits in the last hour
	const hourlyVisits = visitTimestamps.filter((timestamp) => now - timestamp <= oneHour);
	if (hourlyVisits.length >= 4) {
		return true;
	}

	// Count visits in the last 24 hours
	const dailyVisits = visitTimestamps.filter((timestamp) => now - timestamp <= twentyFourHours);
	if (dailyVisits.length >= 6) {
		return true;
	}

	return false;
}

// Function to extract suggestion fields from a URL
export function extractSuggestionFields(urlString) {
	try {
		const url = new URL(urlString);
		let hostname = url.hostname;

		// Remove 'www.' prefix if present
		hostname = hostname.replace(/^www\./, '');

		// Split hostname into parts
		const parts = hostname.split('.');
		
		// Extract domain and subdomain
		let keyword, capitalizedName;
		
		if (parts.length >= 3) {
			// Has subdomain (e.g., docs.google.com)
			const subdomain = parts[0];
			const domain = parts[1];
			
			keyword = `${subdomain}-${domain}`.toLowerCase();
			
			const capitalizedSubdomain = subdomain.charAt(0).toUpperCase() + subdomain.slice(1);
			const capitalizedDomain = domain.charAt(0).toUpperCase() + domain.slice(1);
			capitalizedName = `${capitalizedDomain} ${capitalizedSubdomain}`;
		} else {
			// No subdomain (e.g., google.com)
			keyword = parts[0].toLowerCase();
			capitalizedName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
		}
		
		const description = `Open ${capitalizedName}`;

		return { url: urlString, keyword, description };
	} catch (error) {
		console.error('Error parsing URL:', error);
		return { url: urlString, keyword: '', description: '' };
	}
}
