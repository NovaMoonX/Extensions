const CONTENT_CONTAINERS = ['p', 'li', 'ul li', 'ol li', 'blockquote', 'article p', 'section p'];

function renderArticleLinks(article) {
	if (!article) {
		// console.log('[Article Links Ext.] No article element found.');
		return;
	}

	// Select all links within content containers inside the article
	const selector = CONTENT_CONTAINERS.map((tag) => `${tag} a`).join(',');
	const links = Array.from(article.querySelectorAll(selector));

  const filteredLinks = Array.from(links).filter((link) => {
		const isFullLink = link.href && link.href.startsWith('http');
		const isNotEmpty = link.textContent && link.textContent.trim().length > 0;
		return isFullLink && isNotEmpty;
	});
	// Support zero-state: do not early-return; we'll render a badge.

	const linksList = document.createElement('ul');
	linksList.style.listStyleType = 'disc';
	linksList.style.margin = '0';
	linksList.style.padding = '0 20px';

	function underlineLinkTextInSentence(sentence, linkText) {
		const fragment = document.createDocumentFragment();
		fragment.append(document.createTextNode(' - "'));

		if (!linkText) {
			fragment.append(document.createTextNode(sentence));
			fragment.append(document.createTextNode('"'));
			return fragment;
		}

		const lowerSentence = sentence.toLowerCase();
		const lowerLink = linkText.toLowerCase();
		const idx = lowerSentence.indexOf(lowerLink);

		if (idx === -1) {
			fragment.append(document.createTextNode(sentence));
		} else {
			const before = sentence.slice(0, idx);
			const match = sentence.slice(idx, idx + linkText.length);
			const after = sentence.slice(idx + linkText.length);
			if (before) fragment.append(document.createTextNode(before));
			const underline = document.createElement('span');
			underline.style.textDecoration = 'underline';
			underline.textContent = match;
			fragment.append(underline);
			if (after) fragment.append(document.createTextNode(after));
		}

		fragment.append(document.createTextNode('"'));
		return fragment;
	}

	function sentenceContainingLink(link) {
		const containerText = link.closest('p, span, div')?.textContent || '';
		const normalizedText = containerText.replace(/\s+/g, ' ').trim();
		const linkText = link.textContent?.trim() || '';
		let fullSentence = normalizedText;

		if (linkText) {
			const lower = normalizedText.toLowerCase();
			const idx = lower.indexOf(linkText.toLowerCase());
			if (idx !== -1) {
				const punctuations = ['.', '!', '?', ';', ':'];
				const start = Math.max(...punctuations.map((p) => normalizedText.lastIndexOf(p, idx - 1)));
				const endCandidates = punctuations
					.map((p) => normalizedText.indexOf(p, idx + linkText.length))
					.filter((v) => v !== -1);
				const end = endCandidates.length ? Math.min(...endCandidates) : normalizedText.length;
				const sliceStart = start >= 0 ? start + 1 : 0;
				fullSentence = normalizedText.slice(sliceStart, end).trim();
			}
		}

		if (fullSentence && !/[.!?;:]$/.test(fullSentence)) {
			fullSentence += '.';
		}

		return fullSentence;
	}

	filteredLinks.forEach((link) => {
		const linkElement = document.createElement('a');
		linkElement.href = link.href;
		linkElement.target = '_blank';
		linkElement.textContent = link.textContent;
		// linkElement.style.color = 'blue';
		linkElement.style.fontWeight = '400';

		const fullSentence = sentenceContainingLink(link);
		const snippet = underlineLinkTextInSentence(fullSentence, link.textContent?.trim() || '');
		const listItem = document.createElement('li');
		listItem.style.margin = '0';
		listItem.style.padding = '0';
		listItem.style.fontSize = '14px';
		listItem.appendChild(linkElement);
		listItem.appendChild(snippet);

		// Domain hint shown when full URL is hidden
		const domainSpan = document.createElement('span');
		domainSpan.className = 'domain-hint';
		let hostname = null;
		try {
			hostname = new URL(link.href).hostname;
		} catch (_) {
			const hostMatch = link.href.match(/^https?:\/\/([^/]+)/i);
			hostname = hostMatch ? hostMatch[1] : null;
		}
		if (hostname) {
			domainSpan.textContent = ` (${hostname})`;
			domainSpan.style.fontSize = '12px';
			domainSpan.style.fontWeight = '300';
			domainSpan.style.opacity = '0.6';
			domainSpan.style.marginLeft = '4px';
			listItem.appendChild(domainSpan);
		}

		// Append full URL on its own line, styled to be discreet
		const urlContainer = document.createElement('div');
		urlContainer.style.display = 'block';
		urlContainer.style.marginTop = '2px';
		urlContainer.className = 'full-url';
		const urlAnchor = document.createElement('a');
		urlAnchor.href = link.href;
		urlAnchor.target = '_blank';
		urlAnchor.rel = 'noopener noreferrer';
		urlAnchor.textContent = link.href;
		urlAnchor.style.fontSize = '12px';
		urlAnchor.style.fontWeight = '300';
		urlAnchor.style.opacity = '0.6';
		// Ensure long URLs wrap naturally inside the badge
		urlAnchor.style.overflowWrap = 'anywhere';
		urlAnchor.style.wordBreak = 'break-word';
		urlAnchor.style.maxWidth = '100%';
		urlContainer.appendChild(urlAnchor);
		listItem.appendChild(urlContainer);
		linksList.appendChild(listItem);
	});

	const badge = document.createElement('div');

	const heading = document.createElement('h6');
	heading.textContent =
		filteredLinks.length === 0
			? 'No links found within this article.'
			: filteredLinks.length === 1
			? '1 link found within this article:'
			: `${filteredLinks.length} links found within this article:`;
	heading.style.fontWeight = '600';
	heading.style.margin = '0 0 8px 0';
	heading.style.padding = '0';
	heading.style.fontSize = '14px';
	// Header row with toggle button when links exist
	const headerRow = document.createElement('div');
	headerRow.style.display = 'flex';
	headerRow.style.alignItems = 'center';
	headerRow.style.justifyContent = 'space-between';
	headerRow.appendChild(heading);

	let toggleButton;
	let showingFull = false;
	const setVisibility = (visible) => {
		showingFull = visible;
		if (toggleButton) {
			toggleButton.textContent = visible ? 'Hide full links' : 'Show full links';
		}
		Array.from(linksList.querySelectorAll('.full-url')).forEach((el) => {
			el.style.display = visible ? 'block' : 'none';
		});
		// Show domain hint only when full links are hidden
		Array.from(linksList.querySelectorAll('.domain-hint')).forEach((el) => {
			el.style.display = visible ? 'none' : 'inline';
		});
		// Adjust spacing between list items based on visibility
		Array.from(linksList.children).forEach((li) => {
			if (li && li.tagName === 'LI') {
				li.style.marginBottom = visible ? '10px' : '4px';
			}
		});
	};

	if (filteredLinks.length > 0) {
		toggleButton = document.createElement('button');
		toggleButton.type = 'button';
		toggleButton.textContent = 'Show full links';
		toggleButton.style.fontSize = '12px';
		toggleButton.style.fontWeight = '400';
		toggleButton.style.opacity = '0.7';
		toggleButton.style.padding = '2px 6px';
		toggleButton.style.border = '1px solid #ddd';
		toggleButton.style.borderRadius = '4px';
		toggleButton.style.background = 'transparent';
		toggleButton.style.cursor = 'pointer';
		toggleButton.addEventListener('click', () => setVisibility(!showingFull));
		headerRow.appendChild(toggleButton);
	}

	badge.appendChild(headerRow);
	if (filteredLinks.length > 0) {
		badge.appendChild(linksList);
		// Initialize to hidden state (domain hints visible)
		setVisibility(false);
	}

	badge.style.border = '1px solid #ccc';
	badge.style.backgroundColor = 'transparent';
	badge.style.padding = '16px';
	badge.style.margin = '16px';
	badge.style.borderRadius = '4px';
	badge.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
	badge.style.fontSize = '14px';

	const timeElement = article.querySelector('time');
	let targetParagraph = null;

	const paragraphHasEndingPunctuation = (p) => {
		const text = p?.textContent?.trim() || '';
		return /[.!?;:,]$/.test(text);
	};

	if (timeElement) {
		// Find all paragraphs in the article that end with punctuation
		const punctuatedParagraphs = Array.from(article.querySelectorAll('p')).filter(paragraphHasEndingPunctuation);
		// Find the first punctuated paragraph that comes after the time element
		targetParagraph = punctuatedParagraphs.find(
			(p) => timeElement.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING
		);
	}

	if (!targetParagraph) {
		// Fallback to the first punctuated paragraph in the article
		targetParagraph = Array.from(article.querySelectorAll('p')).find(paragraphHasEndingPunctuation) || null;
	}

	if (targetParagraph) {
		const paragraphStyle = window.getComputedStyle(targetParagraph);
		badge.style.marginLeft = paragraphStyle.marginLeft;
		badge.style.marginRight = paragraphStyle.marginRight;
		targetParagraph.before(badge);
	} else {
		article.prepend(badge);
	}
}

renderArticleLinks(document.querySelector('article'));

const observer = new MutationObserver((mutations) => {
	mutations.forEach((mutation) => {
		mutation.addedNodes.forEach((node) => {
			if (node.nodeType === Node.ELEMENT_NODE) {
				const article = node.matches('article') ? node : node.querySelector('article');
				if (article) {
					// console.log('[Article Links Ext.] Article element added to DOM.');
					renderArticleLinks(article);
				}
			}
		});
	});
});

observer.observe(document.body, { childList: true, subtree: true });
