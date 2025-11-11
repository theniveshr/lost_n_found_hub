// js/main.js

const API_BASE_URL = 'http://localhost:3000/api'; // *** IMPORTANT: ENSURE THIS MATCHES YOUR BACKEND PORT ***

async function fetchData(endpoint, options = {}) {
    // Add Authorization header if a token exists
    const token = localStorage.getItem('userToken');
    if (token) {
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        // Handle HTTP errors (e.g., 401, 403, 404, 500)
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Something went wrong.' }));
            // Specific handling for authentication/authorization errors
            if (response.status === 401 || response.status === 403) {
                console.error('Authentication/Authorization Error:', errorData.message);
                alert('Session expired or unauthorized. Please log in again.');
                localStorage.removeItem('userToken');
                localStorage.removeItem('userRole');
                window.location.href = 'login.html'; // Redirect to login
            }
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('API call failed:', error);
        // Only alert if it's a general network error, not caught by specific HTTP status handling
        if (!error.message.includes('HTTP error!')) {
            alert(`Network Error: ${error.message}. Please check your connection or backend server.`);
        }
        return null; // Return null on error
    }
}

// --- Header and Navigation ---
document.addEventListener('DOMContentLoaded', () => {
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    const navUl = document.querySelector('nav ul'); // Changed from 'nav' to 'nav ul' for consistency with hamburger menu logic
    
    // Get the specific navigation elements
    const navSubmitItem = document.getElementById('navSubmitItem'); // For Submit Item link
    const authNavPlaceholder = document.getElementById('authNavPlaceholder'); // New placeholder for Login/Profile
    const adminLink = document.getElementById('adminLink');
    const logoutButton = document.getElementById('logoutButton');

    // Hamburger menu functionality
    if (hamburgerMenu && navUl) {
        hamburgerMenu.addEventListener('click', () => {
            navUl.classList.toggle('active');
        });
    }

    // --- User Session Management and Navigation Update ---

    /**
     * Checks if a user is authenticated by looking for a token in localStorage.
     * @returns {boolean} True if authenticated, false otherwise.
     */
    const isAuthenticated = () => {
        return localStorage.getItem('userToken') !== null;
    };

    /**
     * Checks if the logged-in user has admin privileges.
     * @returns {boolean} True if the user is an admin, false otherwise.
     */
    const isAdmin = () => {
        return isAuthenticated() && localStorage.getItem('userRole') === 'admin';
    };

    /**
     * Dynamically updates the navigation bar based on the user's login and admin status.
     */
    const updateAuthNav = () => {
        if (authNavPlaceholder) {
            if (isAuthenticated()) {
                // User is logged in: Show Profile link, show Logout button
                authNavPlaceholder.innerHTML = '<li><a href="profile.html"><i class="fas fa-user-circle"></i> Profile</a></li>';
                if (logoutButton) {
                    logoutButton.style.display = 'block';
                }

                // Show Admin link if user is admin
                if (adminLink) {
                    if (isAdmin()) {
                        adminLink.style.display = 'list-item'; // Make admin link visible as a list item
                    } else {
                        adminLink.style.display = 'none'; // Hide if not admin
                    }
                }
            } else {
                // User is NOT logged in: Show Login link, hide Profile, Admin, and Logout
                authNavPlaceholder.innerHTML = '<li><a href="login.html"><i class="fas fa-sign-in-alt"></i> Login</a></li>';
                if (logoutButton) {
                    logoutButton.style.display = 'none';
                }
                if (adminLink) {
                    adminLink.style.display = 'none';
                }
            }
        }
    };

    // Call updateAuthNav on page load
    updateAuthNav();

    // Event listener for the "Submit Item" link (Report an Item Now button in hero section also points here)
    // if (navSubmitItem) {
    //     navSubmitItem.addEventListener('click', (event) => {
    //         if (!isAuthenticated()) {
    //             event.preventDefault(); // Prevent default navigation
    //             const wantsToLogin = confirm('You need to be logged in to submit an item. Do you want to go to the login page now?');
    //             if (wantsToLogin) {
    //                 window.location.href = 'login.html';
    //             }
    //         }
    //     });
    // }

    // Logout button handler
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('userToken'); // Clear the token
            localStorage.removeItem('userRole'); // Clear the role
            alert('You have been logged out.'); // Reverted to alert for simplicity as requested by user's initial code
            updateAuthNav(); // Update navigation immediately
            window.location.href = 'index.html'; // Redirect to home page
        });
    }

    // --- Index Page Logic (Item Listings) ---
    // This part should only run if the current page is index.html
    if (document.getElementById('itemListings')) {
        const itemListingsDiv = document.getElementById('itemListings');
        const searchKeywordInput = document.getElementById('searchKeyword');
        const itemTypeFilterSelect = document.getElementById('itemTypeFilter');
        const categoryFilterSelect = document.getElementById('categoryFilter');
        const searchBtn = document.getElementById('searchBtn');
        const resetFiltersBtn = document.getElementById('resetFiltersBtn');
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        const noItemsMessage = document.getElementById('noItemsMessage');

        let currentPage = 1;
        const itemsPerPage = 8; // Number of items to load per page

        const fetchAndDisplayItems = async (reset = false) => {
            if (reset) {
                // Clear previous results and show skeletons
                itemListingsDiv.innerHTML = '<div class="item-card skeleton"></div><div class="item-card skeleton"></div><div class="item-card skeleton"></div><div class="item-card skeleton"></div>';
                currentPage = 1;
                loadMoreBtn.style.display = 'none';
                noItemsMessage.style.display = 'none';
            } else {
                // Add more skeletons for "Load More"
                for (let i = 0; i < 4; i++) {
                    itemListingsDiv.appendChild(createSkeletonCard());
                }
            }

            const keyword = searchKeywordInput.value.trim();
            const itemType = itemTypeFilterSelect.value;
            const category = categoryFilterSelect.value;

            let queryParams = `?page=${currentPage}&limit=${itemsPerPage}`;
            if (keyword) queryParams += `&keyword=${encodeURIComponent(keyword)}`;
            if (itemType) queryParams += `&type=${encodeURIComponent(itemType)}`;
            if (category) queryParams += `&category=${encodeURIComponent(category)}`;

            const data = await fetchData(`/items${queryParams}`);

            // Remove all skeleton cards after fetch attempt
            itemListingsDiv.querySelectorAll('.skeleton').forEach(s => s.remove());

            if (data && data.items && data.items.length > 0) {
                if (reset) {
                    itemListingsDiv.innerHTML = ''; // Clear existing items on full reset
                }
                data.items.forEach(item => {
                    const itemCard = createItemCard(item);
                    itemListingsDiv.appendChild(itemCard);
                });

                // Determine if 'Load More' button should be shown
                if (data.items.length === itemsPerPage) {
                    loadMoreBtn.style.display = 'block';
                } else {
                    loadMoreBtn.style.display = 'none'; // No more items to load
                }
                noItemsMessage.style.display = 'none';
            } else {
                // If no data, or data.items is empty
                if (reset) {
                    itemListingsDiv.innerHTML = ''; // Clear previous items
                    noItemsMessage.style.display = 'block';
                    noItemsMessage.textContent = 'No items found matching your criteria.';
                } else {
                    // If load more returns no items, just hide load more.
                    noItemsMessage.textContent = 'No more items to load.'; // More specific message
                }
                loadMoreBtn.style.display = 'none';
            }

            currentPage++; // Increment for the *next* potential load more click
        };

        const createItemCard = (item) => {
            const card = document.createElement('div');
            card.className = 'item-card';
            card.dataset.itemId = item.id; // Store item ID for detail page navigation

            // Construct the image URL. Backend serves uploads from /uploads/
            const imageUrl = item.image_url ? `http://localhost:${PORT}${item.image_url}` : 'images/placeholder.png'; // Use backend PORT for images

            card.innerHTML = `
                <img src="${imageUrl}" alt="${item.name}" onerror="this.onerror=null;this.src='images/placeholder.png';">
                <div class="item-card-content">
                    <span class="status ${item.type.toLowerCase()}">${item.type}</span>
                    <h3>${item.name}</h3>
                    <p class="category">Category: ${item.category}</p>
                    <p>${item.description.substring(0, 70)}...</p>
                    <p class="location-date"><i class="fas fa-map-marker-alt"></i> ${item.location}</p>
                    <p class="location-date"><i class="fas fa-calendar-alt"></i> ${new Date(item.date_reported).toLocaleDateString()}</p>
                </div>
            `;
            card.addEventListener('click', () => {
                window.location.href = `item-details.html?id=${item.id}`;
            });
            return card;
        };

        const createSkeletonCard = () => {
            const skeleton = document.createElement('div');
            skeleton.className = 'item-card skeleton';
            return skeleton;
        };

        // Event Listeners for Filters & Search
        searchBtn.addEventListener('click', () => fetchAndDisplayItems(true));
        searchKeywordInput.addEventListener('keypress', (e) => { // Added keypress for search
            if (e.key === 'Enter') fetchAndDisplayItems(true);
        });
        itemTypeFilterSelect.addEventListener('change', () => fetchAndDisplayItems(true));
        categoryFilterSelect.addEventListener('change', () => fetchAndDisplayItems(true));
        resetFiltersBtn.addEventListener('click', () => {
            searchKeywordInput.value = '';
            itemTypeFilterSelect.value = '';
            categoryFilterSelect.value = '';
            fetchAndDisplayItems(true);
        });
        loadMoreBtn.addEventListener('click', () => fetchAndDisplayItems(false));

        // Initial load of items when the page loads
        fetchAndDisplayItems(true);
    }

    // --- Item Details Page Logic ---
    // This part should only run if the current page is item-details.html
    if (document.getElementById('itemDetail')) {
        const itemDetailSection = document.getElementById('itemDetail');
        const claimItemBtn = document.getElementById('claimItemBtn');
        const urlParams = new URLSearchParams(window.location.search);
        const itemId = urlParams.get('id');
        let currentItem = null; // Store item data for claim button access

        if (itemId) {
            const fetchItemDetails = async () => {
                const item = await fetchData(`/items/${itemId}`);
                if (item) {
                    currentItem = item; // Store item for claim button
                    displayItemDetails(item);
                } else {
                    itemDetailSection.innerHTML = '<p class="error-message">Item not found or an error occurred.</p>';
                }
            };

            const displayItemDetails = (item) => {
                const imageUrl = item.image_url ? `http://localhost:${PORT}${item.image_url}` : '../images/placeholder.png'; // Adjusted path for item-details page

                itemDetailSection.innerHTML = `
                    <img src="${imageUrl}" alt="${item.name}" class="item-detail-image" onerror="this.onerror=null;this.src='../images/placeholder.png';">
                    <div class="item-detail-content">
                        <span class="detail-status ${item.type.toLowerCase()}">${item.type}</span>
                        <h1>${item.name}</h1>
                        <p><strong>Category:</strong> ${item.category}</p>
                        <p><strong>Description:</strong> ${item.description}</p>
                        <p><strong>Location:</strong> <i class="fas fa-map-marker-alt"></i> ${item.location}</p>
                        <p><strong>Date Reported:</strong> <i class="fas fa-calendar-alt"></i> ${new Date(item.date_reported).toLocaleDateString()}</p>
                        <div class="contact-info">
                            <strong>Contact Information:</strong>
                            <span><i class="fas fa-envelope"></i> ${item.contact_email}</span>
                            <p class="help-text">Please contact this email for further discussion.</p>
                        </div>
                    </div>
                `;
                // Show claim button only if item status is Active or Claimed (not resolved)
                if (claimItemBtn) {
                     if (item.status === 'Active' || item.status === 'Claimed') {
                        claimItemBtn.style.display = 'block';
                    } else {
                        claimItemBtn.style.display = 'none';
                    }
                }
            };

            fetchItemDetails();

            if (claimItemBtn) {
                claimItemBtn.addEventListener('click', async () => {
                    if (!isAuthenticated()) {
                        const wantsToLogin = confirm('You need to be logged in to claim an item. Do you want to go to the login page now?');
                        if (wantsToLogin) {
                            window.location.href = 'login.html';
                        }
                        return; // Stop if not logged in
                    }
                    
                    // Prompt for claim details
                    const claimDetails = prompt(`To claim "${currentItem.name}", please provide details only the rightful owner would know (e.g., specific brand, contents, unique marks):`);
                    
                    if (claimDetails) {
                        try {
                            const response = await fetchData('/claims', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ item_id: currentItem.id, claim_details: claimDetails })
                            });

                            if (response) {
                                alert(`Claim submitted successfully for "${currentItem.name}". An administrator will review your claim.`);
                                // Optionally disable the claim button or redirect
                                if (claimItemBtn) claimItemBtn.style.display = 'none';
                            } else {
                                alert('Failed to submit claim. Please try again.');
                            }
                        } catch (error) {
                            console.error('Error submitting claim:', error);
                            alert('An error occurred while submitting your claim.');
                        }
                    } else {
                        alert('Claim cancelled: Details not provided.');
                    }
                });
            }
        } else {
            itemDetailSection.innerHTML = '<p class="error-message">No item ID provided in the URL.</p>';
        }
    }
});
