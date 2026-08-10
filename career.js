/* ===================================
   CAREER SECTION - JAVASCRIPT
   Smart Computer & Education Institute
   =================================== */

// ===================================
// GLOBAL VARIABLES
// ===================================
let selectedFile = null;
let currentJobTitle = '';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];

// ===================================
// INITIALIZATION
// ===================================
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    setupFileUploadDragDrop();
});

// ===================================
// EVENT LISTENERS
// ===================================
function initializeEventListeners() {
    // File upload area click
    const fileUploadArea = document.getElementById('fileUploadArea');
    if (fileUploadArea) {
        fileUploadArea.addEventListener('click', () => {
            document.getElementById('cvFile').click();
        });
    }

    // File input change
    const cvFileInput = document.getElementById('cvFile');
    if (cvFileInput) {
        cvFileInput.addEventListener('change', handleFileSelect);
    }

    // Modal close on outside click
    const modal = document.getElementById('applicationModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeApplication();
            }
        });
    }

    // Escape key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeApplication();
        }
    });
}

// ===================================
// FILE UPLOAD FUNCTIONS
// ===================================
function setupFileUploadDragDrop() {
    const fileUploadArea = document.getElementById('fileUploadArea');
    
    if (!fileUploadArea) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        fileUploadArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        fileUploadArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        fileUploadArea.addEventListener(eventName, unhighlight, false);
    });

    function highlight(e) {
        fileUploadArea.classList.add('dragover');
    }

    function unhighlight(e) {
        fileUploadArea.classList.remove('dragover');
    }

    fileUploadArea.addEventListener('drop', handleDrop, false);
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
        validateAndSetFile(files[0]);
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        validateAndSetFile(file);
    }
}

function validateAndSetFile(file) {
    const errorElement = document.getElementById('cvError');
    errorElement.textContent = '';

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        errorElement.textContent = 'File size exceeds 5MB. Please upload a smaller file.';
        clearFileInput();
        return;
    }

    // Check file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        errorElement.textContent = 'Invalid file format. Please upload PDF, DOC, DOCX, or TXT file.';
        clearFileInput();
        return;
    }

    selectedFile = file;
    displayFilePreview(file);
}

function displayFilePreview(file) {
    const preview = document.getElementById('filePreview');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');

    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    
    document.getElementById('fileUploadArea').style.display = 'none';
    preview.style.display = 'block';
}

function removeFile() {
    selectedFile = null;
    clearFileInput();
    
    document.getElementById('fileUploadArea').style.display = 'block';
    document.getElementById('filePreview').style.display = 'none';
    document.getElementById('cvError').textContent = '';
}

function clearFileInput() {
    const cvFileInput = document.getElementById('cvFile');
    cvFileInput.value = '';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ===================================
// APPLICATION MODAL
// ===================================
function openApplication(buttonElement) {
    const jobTitle = buttonElement.closest('.job-card').querySelector('.job-title').textContent;
    currentJobTitle = jobTitle;
    document.getElementById('modalJobTitle').textContent = `Apply for ${jobTitle}`;
    document.getElementById('applicationModal').classList.add('show');
    document.body.style.overflow = 'hidden';
    
    // Reset form
    document.getElementById('applicationForm').reset();
    removeFile();
    clearFormErrors();
}

function closeApplication() {
    document.getElementById('applicationModal').classList.remove('show');
    document.body.style.overflow = 'auto';
    document.getElementById('applicationForm').reset();
    removeFile();
    clearFormErrors();
    selectedFile = null;
}

// ===================================
// FORM VALIDATION
// ===================================
function clearFormErrors() {
    const errorElements = document.querySelectorAll('.form-error');
    errorElements.forEach(el => el.textContent = '');
}

function validateForm() {
    clearFormErrors();
    let isValid = true;

    // Full Name validation
    const fullName = document.getElementById('fullName').value.trim();
    if (!fullName || fullName.length < 2) {
        document.getElementById('fullNameError').textContent = 'Please enter a valid full name';
        isValid = false;
    }

    // Phone validation
    const phone = document.getElementById('phone').value.trim();
    const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
    if (!phone || !phoneRegex.test(phone)) {
        document.getElementById('phoneError').textContent = 'Please enter a valid phone number';
        isValid = false;
    }

    // Email validation
    const email = document.getElementById('email').value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        document.getElementById('emailError').textContent = 'Please enter a valid email address';
        isValid = false;
    }

    // Experience validation
    const experience = document.getElementById('experience').value;
    if (!experience || experience < 0 || experience > 60) {
        document.getElementById('experienceError').textContent = 'Please enter valid years of experience';
        isValid = false;
    }

    // Education validation
    const education = document.getElementById('education').value;
    if (!education) {
        document.getElementById('educationError').textContent = 'Please select your educational qualification';
        isValid = false;
    }

    // CV validation
    if (!selectedFile) {
        document.getElementById('cvError').textContent = 'Please upload your CV/Resume';
        isValid = false;
    }

    // Terms validation
    if (!document.getElementById('terms').checked) {
        document.getElementById('termsError').textContent = 'Please agree to the terms and conditions';
        isValid = false;
    }

    return isValid;
}

// ===================================
// FORM SUBMISSION
// ===================================
function handleSubmit(event) {
    event.preventDefault();

    // Validate form
    if (!validateForm()) {
        showErrorMessage('Please fill in all required fields correctly');
        return;
    }

    // Collect form data
    const formData = new FormData();
    formData.append('fullName', document.getElementById('fullName').value);
    formData.append('email', document.getElementById('email').value);
    formData.append('phone', document.getElementById('phone').value);
    formData.append('experience', document.getElementById('experience').value);
    formData.append('currentPosition', document.getElementById('currentPosition').value);
    formData.append('education', document.getElementById('education').value);
    formData.append('field', document.getElementById('field').value);
    formData.append('skills', document.getElementById('skills').value);
    formData.append('coverLetter', document.getElementById('coverLetter').value);
    formData.append('jobTitle', currentJobTitle);
    
    if (selectedFile) {
        formData.append('cvFile', selectedFile);
    }

    // Simulate form submission (replace with actual API call)
    submitApplication(formData);
}

function submitApplication(formData) {
    // Show loading state
    const submitBtn = document.querySelector('.submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    // Simulate API delay
    setTimeout(() => {
        const fullName = formData.get('fullName');
        const email = formData.get('email');
        const jobTitle = formData.get('jobTitle');

        // Show success message
        showSuccessMessage(fullName, email, jobTitle);

        // Reset button state
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;

        // Close modal
        closeApplication();

        // Log application data (for testing)
        console.log('Application submitted:', {
            fullName: formData.get('fullName'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            experience: formData.get('experience'),
            education: formData.get('education'),
            jobTitle: formData.get('jobTitle'),
            file: selectedFile ? selectedFile.name : 'No file'
        });

        // TODO: Send to backend API
        // Example: fetch('/api/applications', { method: 'POST', body: formData })
    }, 1500);
}

// ===================================
// SUCCESS & ERROR MESSAGES
// ===================================
function showSuccessMessage(fullName, email, jobTitle) {
    const successMsg = document.getElementById('successMessage');
    const successDetails = document.getElementById('successDetails');
    
    successDetails.innerHTML = `
        <strong>${fullName}</strong> - Your application for <strong>${jobTitle}</strong> 
        has been submitted successfully. We'll contact you at <strong>${email}</strong> soon.
    `;
    
    successMsg.classList.add('show');

    setTimeout(() => {
        successMsg.classList.remove('show');
    }, 5000);
}

function showErrorMessage(message) {
    const errorMsg = document.getElementById('errorMessage');
    const errorDetails = document.getElementById('errorDetails');
    
    errorDetails.textContent = message;
    errorMsg.classList.add('show');

    setTimeout(() => {
        errorMsg.classList.remove('show');
    }, 4000);
}

// ===================================
// JOB FILTERING
// ===================================
function filterJobs(category) {
    const cards = document.querySelectorAll('.job-card');
    const buttons = document.querySelectorAll('.filter-btn');
    
    // Update active button
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Filter cards with animation
    cards.forEach(card => {
        if (category === 'all' || card.dataset.category === category) {
            card.style.animation = 'none';
            setTimeout(() => {
                card.style.display = 'block';
                card.style.animation = 'slideUp 0.3s ease';
            }, 0);
        } else {
            card.style.display = 'none';
        }
    });
}

// ===================================
// UTILITY FUNCTIONS
// ===================================
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

// Add real-time validation
document.addEventListener('DOMContentLoaded', function() {
    const emailInput = document.getElementById('email');
    if (emailInput) {
        emailInput.addEventListener('blur', function() {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (this.value && !emailRegex.test(this.value)) {
                document.getElementById('emailError').textContent = 'Please enter a valid email address';
            } else {
                document.getElementById('emailError').textContent = '';
            }
        });
    }

    const phoneInput = document.getElementById('phone');
    if (phoneInput) {
        phoneInput.addEventListener('blur', function() {
            const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
            if (this.value && !phoneRegex.test(this.value)) {
                document.getElementById('phoneError').textContent = 'Please enter a valid phone number';
            } else {
                document.getElementById('phoneError').textContent = '';
            }
        });
    }

    const fullNameInput = document.getElementById('fullName');
    if (fullNameInput) {
        fullNameInput.addEventListener('blur', function() {
            if (this.value && this.value.trim().length < 2) {
                document.getElementById('fullNameError').textContent = 'Name must be at least 2 characters';
            } else {
                document.getElementById('fullNameError').textContent = '';
            }
        });
    }
});

// ===================================
// ANALYTICS & TRACKING (Optional)
// ===================================
function trackEvent(eventName, eventData) {
    // Replace with your analytics service (Google Analytics, Mixpanel, etc.)
    console.log(`Event: ${eventName}`, eventData);
    
    // Example: Google Analytics
    // if (window.gtag) {
    //     gtag('event', eventName, eventData);
    // }
}

// Track when user opens application modal
function trackApplicationOpen(jobTitle) {
    trackEvent('application_opened', { job_title: jobTitle });
}

// Track when user submits application
function trackApplicationSubmit(jobTitle, email) {
    trackEvent('application_submitted', { 
        job_title: jobTitle,
        email: email 
    });
}

// Track job filter
function trackJobFilter(category) {
    trackEvent('job_filtered', { category: category });
}