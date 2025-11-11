// admin.js - Admin Dashboard Functionality

// Sample data for demonstration
let itemsData = [
    {
        id: 1,
        type: 'Lost',
        name: 'Blue Water Bottle',
        category: 'Accessories',
        location: 'CSE Lab',
        date: '2025-01-15',
        reporterEmail: 'student1@example.com',
        status: 'Active',
        description: 'Blue stainless steel water bottle with college logo'
    },
    {
        id: 2,
        type: 'Found',
        name: 'Black Leather Wallet',
        category: 'Wallets',
        location: 'Library 3rd Floor',
        date: '2025-01-14',
        reporterEmail: 'student2@example.com',
        status: 'Claimed',
        description: 'Black leather wallet containing ID card and some cash'
    },
    {
        id: 3,
        type: 'Lost',
        name: 'Wireless Earbuds',
        category: 'Electronics',
        location: 'Sports Complex',
        date: '2025-01-13',
        reporterEmail: 'student3@example.com',
        status: 'Active',
        description: 'White wireless earbuds in a charging case'
    },
    {
        id: 4,
        type: 'Found',
        name: 'Textbook - Calculus',
        category: 'Books',
        location: 'Math Department',
        date: '2025-01-12',
        reporterEmail: 'professor1@example.com',
        status: 'Resolved',
        description: 'Calculus textbook with notes in margins'
    },
    {
        id: 5,
        type: 'Lost',
        name: 'Student ID Card',
        category: 'ID Cards',
        location: 'Cafeteria',
        date: '2025-01-11',
        reporterEmail: 'student4@example.com',
        status: 'Archived',
        description: 'Student ID card with photo'
    }
];

let claimsData = [
    {
        claimId: 101,
        itemName: 'Black Leather Wallet',
        claimantUsername: 'john_doe',
        claimDetails: 'I lost my wallet in the library yesterday',
        claimedAt: '2025-01-15 14:30',
        status: 'Pending'
    },
    {
        claimId: 102,
        itemName: 'Textbook - Calculus',
        claimantUsername: 'jane_smith',
        claimDetails: 'This is my calculus textbook with my notes',
        claimedAt: '2025-01-14 10:15',
        status: 'Approved'
    }
];

// DOM elements
let itemsTableBody, claimsTableBody;
let searchKeyword, itemTypeFilter, itemStatusFilter;
let searchBtn, resetFiltersBtn;
let actionModal, modalTitle, modalMessage, confirmActionBtn, cancelActionBtn;

// Current action context
let currentAction = null;
let currentItemId = null;
let currentClaimId = null;

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    loadItemsTable();
    loadClaimsTable();
    setupEventListeners();
});

function initializeElements() {
    // Table bodies
    itemsTableBody = document.querySelector('#adminItemsTable tbody');
    claimsTableBody = document.querySelector('#adminClaimsTable tbody');
    
    // Filter and search elements
    searchKeyword = document.getElementById('adminSearchKeyword');
    itemTypeFilter = document.getElementById('adminItemTypeFilter');
    itemStatusFilter = document.getElementById('adminItemStatusFilter');
    searchBtn = document.getElementById('adminSearchBtn');
    resetFiltersBtn = document.getElementById('adminResetFiltersBtn');
    
    // Modal elements
    actionModal = document.getElementById('actionModal');
    modalTitle = document.getElementById('modalTitle');
    modalMessage = document.getElementById('modalMessage');
    confirmActionBtn = document.getElementById('confirmActionButton');
    cancelActionBtn = document.getElementById('cancelActionButton');
    
    // Logout button
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', function() {
            if (confirm('Are you sure you want to logout?')) {
                // In a real application, you would clear session/token here
                window.location.href = 'login.html';
            }
        });
    }
    
    // Hamburger menu
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    const nav = document.querySelector('nav');
    
    if (hamburgerMenu && nav) {
        hamburgerMenu.addEventListener('click', function() {
            nav.classList.toggle('active');
        });
    }
}

function setupEventListeners() {
    // Search and filter events
    searchBtn.addEventListener('click', filterItems);
    resetFiltersBtn.addEventListener('click', resetFilters);
    
    // Modal events
    document.querySelector('.close-button').addEventListener('click', closeModal);
    cancelActionBtn.addEventListener('click', closeModal);
    confirmActionBtn.addEventListener('click', executeAction);
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === actionModal) {
            closeModal();
        }
    });
}

function loadItemsTable() {
    if (itemsTableBody) {
        // Clear loading message
        itemsTableBody.innerHTML = '';
        
        if (itemsData.length === 0) {
            document.getElementById('noAdminItemsMessage').style.display = 'block';
            return;
        }
        
        document.getElementById('noAdminItemsMessage').style.display = 'none';
        
        // Populate table with items
        itemsData.forEach(item => {
            const row = document.createElement('tr');
            
            // Determine status badge class
            let statusClass = 'status-active';
            if (item.status === 'Claimed') statusClass = 'status-claimed';
            else if (item.status === 'Resolved') statusClass = 'status-resolved';
            else if (item.status === 'Archived') statusClass = 'status-archived';
            
            row.innerHTML = `
                <td>${item.id}</td>
                <td>${item.type}</td>
                <td>${item.name}</td>
                <td>${item.category}</td>
                <td>${item.location}</td>
                <td>${formatDate(item.date)}</td>
                <td>${item.reporterEmail}</td>
                <td><span class="status-badge ${statusClass}">${item.status}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-primary btn-sm view-item" data-id="${item.id}">
                            <i class="fas fa-eye"></i> View
                        </button>
                        <button class="btn btn-warning btn-sm edit-item" data-id="${item.id}">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-danger btn-sm delete-item" data-id="${item.id}">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </td>
            `;
            
            itemsTableBody.appendChild(row);
        });
        
        // Add event listeners to action buttons
        document.querySelectorAll('.view-item').forEach(button => {
            button.addEventListener('click', function() {
                const itemId = this.getAttribute('data-id');
                viewItem(itemId);
            });
        });
        
        document.querySelectorAll('.edit-item').forEach(button => {
            button.addEventListener('click', function() {
                const itemId = this.getAttribute('data-id');
                editItem(itemId);
            });
        });
        
        document.querySelectorAll('.delete-item').forEach(button => {
            button.addEventListener('click', function() {
                const itemId = this.getAttribute('data-id');
                confirmDeleteItem(itemId);
            });
        });
    }
}

function loadClaimsTable() {
    if (claimsTableBody) {
        // Clear loading message
        claimsTableBody.innerHTML = '';
        
        if (claimsData.length === 0) {
            document.getElementById('noAdminClaimsMessage').style.display = 'block';
            return;
        }
        
        document.getElementById('noAdminClaimsMessage').style.display = 'none';
        
        // Populate table with claims
        claimsData.forEach(claim => {
            const row = document.createElement('tr');
            
            // Determine status badge class
            let statusClass = 'status-active';
            if (claim.status === 'Approved') statusClass = 'status-resolved';
            else if (claim.status === 'Rejected') statusClass = 'status-archived';
            
            row.innerHTML = `
                <td>${claim.claimId}</td>
                <td>${claim.itemName}</td>
                <td>${claim.claimantUsername}</td>
                <td>${claim.claimDetails}</td>
                <td>${formatDateTime(claim.claimedAt)}</td>
                <td><span class="status-badge ${statusClass}">${claim.status}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-primary btn-sm view-claim" data-id="${claim.claimId}">
                            <i class="fas fa-eye"></i> View
                        </button>
                        ${claim.status === 'Pending' ? `
                        <button class="btn btn-success btn-sm approve-claim" data-id="${claim.claimId}">
                            <i class="fas fa-check"></i> Approve
                        </button>
                        <button class="btn btn-danger btn-sm reject-claim" data-id="${claim.claimId}">
                            <i class="fas fa-times"></i> Reject
                        </button>
                        ` : ''}
                    </div>
                </td>
            `;
            
            claimsTableBody.appendChild(row);
        });
        
        // Add event listeners to action buttons
        document.querySelectorAll('.view-claim').forEach(button => {
            button.addEventListener('click', function() {
                const claimId = this.getAttribute('data-id');
                viewClaim(claimId);
            });
        });
        
        document.querySelectorAll('.approve-claim').forEach(button => {
            button.addEventListener('click', function() {
                const claimId = this.getAttribute('data-id');
                confirmApproveClaim(claimId);
            });
        });
        
        document.querySelectorAll('.reject-claim').forEach(button => {
            button.addEventListener('click', function() {
                const claimId = this.getAttribute('data-id');
                confirmRejectClaim(claimId);
            });
        });
    }
}

function filterItems() {
    const keyword = searchKeyword.value.toLowerCase();
    const typeFilter = itemTypeFilter.value;
    const statusFilter = itemStatusFilter.value;
    
    const filteredItems = itemsData.filter(item => {
        const matchesKeyword = 
            item.name.toLowerCase().includes(keyword) ||
            item.location.toLowerCase().includes(keyword) ||
            item.category.toLowerCase().includes(keyword);
        
        const matchesType = typeFilter === '' || item.type === typeFilter;
        const matchesStatus = statusFilter === '' || item.status === statusFilter;
        
        return matchesKeyword && matchesType && matchesStatus;
    });
    
    // Update table with filtered items
    updateItemsTable(filteredItems);
}

function resetFilters() {
    searchKeyword.value = '';
    itemTypeFilter.value = '';
    itemStatusFilter.value = '';
    
    // Reload all items
    loadItemsTable();
}

function updateItemsTable(items) {
    if (itemsTableBody) {
        itemsTableBody.innerHTML = '';
        
        if (items.length === 0) {
            document.getElementById('noAdminItemsMessage').style.display = 'block';
            return;
        }
        
        document.getElementById('noAdminItemsMessage').style.display = 'none';
        
        items.forEach(item => {
            const row = document.createElement('tr');
            
            // Determine status badge class
            let statusClass = 'status-active';
            if (item.status === 'Claimed') statusClass = 'status-claimed';
            else if (item.status === 'Resolved') statusClass = 'status-resolved';
            else if (item.status === 'Archived') statusClass = 'status-archived';
            
            row.innerHTML = `
                <td>${item.id}</td>
                <td>${item.type}</td>
                <td>${item.name}</td>
                <td>${item.category}</td>
                <td>${item.location}</td>
                <td>${formatDate(item.date)}</td>
                <td>${item.reporterEmail}</td>
                <td><span class="status-badge ${statusClass}">${item.status}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-primary btn-sm view-item" data-id="${item.id}">
                            <i class="fas fa-eye"></i> View
                        </button>
                        <button class="btn btn-warning btn-sm edit-item" data-id="${item.id}">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-danger btn-sm delete-item" data-id="${item.id}">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </td>
            `;
            
            itemsTableBody.appendChild(row);
        });
        
        // Reattach event listeners
        document.querySelectorAll('.view-item').forEach(button => {
            button.addEventListener('click', function() {
                const itemId = this.getAttribute('data-id');
                viewItem(itemId);
            });
        });
        
        document.querySelectorAll('.edit-item').forEach(button => {
            button.addEventListener('click', function() {
                const itemId = this.getAttribute('data-id');
                editItem(itemId);
            });
        });
        
        document.querySelectorAll('.delete-item').forEach(button => {
            button.addEventListener('click', function() {
                const itemId = this.getAttribute('data-id');
                confirmDeleteItem(itemId);
            });
        });
    }
}

// Item Actions
function viewItem(itemId) {
    const item = itemsData.find(i => i.id == itemId);
    if (item) {
        alert(`Item Details:\n\nID: ${item.id}\nType: ${item.type}\nName: ${item.name}\nCategory: ${item.category}\nDescription: ${item.description}\nLocation: ${item.location}\nDate: ${item.date}\nReporter Email: ${item.reporterEmail}\nStatus: ${item.status}`);
    }
}

function editItem(itemId) {
    const item = itemsData.find(i => i.id == itemId);
    if (item) {
        // In a real application, you would show an edit form/modal
        alert(`Editing item: ${item.name}\n\nThis would open an edit form in a real application.`);
    }
}

function confirmDeleteItem(itemId) {
    const item = itemsData.find(i => i.id == itemId);
    if (item) {
        currentAction = 'deleteItem';
        currentItemId = itemId;
        
        modalTitle.textContent = 'Confirm Deletion';
        modalMessage.textContent = `Are you sure you want to delete the item "${item.name}"? This action cannot be undone.`;
        actionModal.style.display = 'flex';
    }
}

// Claim Actions
function viewClaim(claimId) {
    const claim = claimsData.find(c => c.claimId == claimId);
    if (claim) {
        alert(`Claim Details:\n\nClaim ID: ${claim.claimId}\nItem: ${claim.itemName}\nClaimant: ${claim.claimantUsername}\nDetails: ${claim.claimDetails}\nClaimed At: ${claim.claimedAt}\nStatus: ${claim.status}`);
    }
}

function confirmApproveClaim(claimId) {
    const claim = claimsData.find(c => c.claimId == claimId);
    if (claim) {
        currentAction = 'approveClaim';
        currentClaimId = claimId;
        
        modalTitle.textContent = 'Approve Claim';
        modalMessage.textContent = `Are you sure you want to approve the claim for "${claim.itemName}" by ${claim.claimantUsername}?`;
        actionModal.style.display = 'flex';
    }
}

function confirmRejectClaim(claimId) {
    const claim = claimsData.find(c => c.claimId == claimId);
    if (claim) {
        currentAction = 'rejectClaim';
        currentClaimId = claimId;
        
        modalTitle.textContent = 'Reject Claim';
        modalMessage.textContent = `Are you sure you want to reject the claim for "${claim.itemName}" by ${claim.claimantUsername}?`;
        actionModal.style.display = 'flex';
    }
}

// Modal Functions
function closeModal() {
    actionModal.style.display = 'none';
    currentAction = null;
    currentItemId = null;
    currentClaimId = null;
}

function executeAction() {
    switch (currentAction) {
        case 'deleteItem':
            deleteItem(currentItemId);
            break;
        case 'approveClaim':
            approveClaim(currentClaimId);
            break;
        case 'rejectClaim':
            rejectClaim(currentClaimId);
            break;
    }
    closeModal();
}

function deleteItem(itemId) {
    // Remove item from data
    itemsData = itemsData.filter(item => item.id != itemId);
    
    // Reload table
    loadItemsTable();
    
    // Show success message
    alert('Item deleted successfully!');
}

function approveClaim(claimId) {
    // Update claim status
    const claim = claimsData.find(c => c.claimId == claimId);
    if (claim) {
        claim.status = 'Approved';
        
        // Update corresponding item status if found
        const item = itemsData.find(i => i.name === claim.itemName);
        if (item) {
            item.status = 'Resolved';
        }
        
        // Reload tables
        loadItemsTable();
        loadClaimsTable();
        
        // Show success message
        alert('Claim approved successfully!');
    }
}

function rejectClaim(claimId) {
    // Update claim status
    const claim = claimsData.find(c => c.claimId == claimId);
    if (claim) {
        claim.status = 'Rejected';
        
        // Reload table
        loadClaimsTable();
        
        // Show success message
        alert('Claim rejected successfully!');
    }
}

// Utility Functions
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

function formatDateTime(dateTimeString) {
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return new Date(dateTimeString).toLocaleDateString(undefined, options);
}