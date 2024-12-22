// Using the free MedAPI (example - you'll need to sign up for a free API key)
const MED_API_KEY = '2f76e71d99msh2d0f67c7f1c5f5ep1c1a5djsn5f3c50656c4d'; // Sign up at https://apimedic.com/ for a free API key
const SYMPTOMS_API = 'https://sandbox-healthservice.priaid.ch/symptoms';
const DIAGNOSIS_API = 'https://sandbox-healthservice.priaid.ch/diagnosis';

// Get DOM elements
const chatBody = document.getElementById('chatBody');
const userInput = document.getElementById('userInput');

// Initialize conversation context
let conversationContext = {
    symptoms: [],
    previousDiagnosis: null
};

// Function to add messages to chat
function addMessage(message, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = isUser ? 'chat-message user-message' : 'chat-message bot-message';
    messageDiv.textContent = message;
    chatBody.appendChild(messageDiv);
    chatBody.scrollTop = chatBody.scrollHeight;
}

// Function to get auth token
async function getAuthToken() {
    const computedHash = CryptoJS.HmacMD5(SYMPTOMS_API, MED_API_KEY);
    const computedHashString = computedHash.toString(CryptoJS.enc.Base64);
    
    try {
        const response = await fetch('https://sandbox-authservice.priaid.ch/login', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${computedHashString}`
            }
        });
        
        if (!response.ok) throw new Error('Auth failed');
        const data = await response.json();
        return data.Token;
    } catch (error) {
        console.error('Auth error:', error);
        return null;
    }
}

// Function to get symptoms list
async function getSymptoms(token) {
    try {
        const response = await fetch(`${SYMPTOMS_API}?token=${token}&language=en-gb`);
        if (!response.ok) throw new Error('Failed to fetch symptoms');
        return await response.json();
    } catch (error) {
        console.error('Symptoms error:', error);
        return [];
    }
}

// Function to get diagnosis
async function getDiagnosis(token, symptoms, gender, birthYear) {
    try {
        const url = `${DIAGNOSIS_API}?symptoms=[${symptoms.join(',')}]&gender=${gender}&year_of_birth=${birthYear}&token=${token}&language=en-gb`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch diagnosis');
        return await response.json();
    } catch (error) {
        console.error('Diagnosis error:', error);
        return [];
    }
}

// Alternative free API for general health information
async function getHealthInfo(query) {
    try {
        const response = await fetch(`https://health.gov/myhealthfinder/api/v3/topicsearch.json?keyword=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('Failed to fetch health info');
        const data = await response.json();
        return data.Result.Resources.Resource[0]?.Content || "No specific information found.";
    } catch (error) {
        console.error('Health info error:', error);
        return "Unable to fetch health information at the moment.";
    }
}

// Function to process user message and get appropriate response
async function processUserMessage(message) {
    // First, try to get health information
    const healthInfo = await getHealthInfo(message);
    
    // If we have an auth token, also try to get symptoms and diagnosis
    const token = await getAuthToken();
    if (token) {
        const symptoms = await getSymptoms(token);
        // Basic symptom matching
        const matchedSymptoms = symptoms.filter(symptom => 
            message.toLowerCase().includes(symptom.Name.toLowerCase())
        );
        
        if (matchedSymptoms.length > 0) {
            const diagnosis = await getDiagnosis(token, 
                matchedSymptoms.map(s => s.ID),
                'male', // Default gender (you might want to ask the user)
                1990    // Default birth year (you might want to ask the user)
            );
            
            return `Based on your symptoms, here's what I found:\n\n${healthInfo}\n\nPossible conditions to discuss with your doctor:\n${
                diagnosis.map(d => `- ${d.Issue.Name} (Accuracy: ${d.Issue.Accuracy}%)`).join('\n')
            }\n\nPlease note: This is not a substitute for professional medical advice. Always consult with a healthcare provider.`;
        }
    }
    
    // If no specific symptoms matched or API failed, return general health info
    return `Here's what I found about your query:\n\n${healthInfo}\n\nPlease note: This is not a substitute for professional medical advice. Always consult with a healthcare provider.`;
}

// Function to handle sending messages
async function sendMessage() {
    const message = userInput.value.trim();
    if (message === '') return;

    // Add user message to chat
    addMessage(message, true);
    userInput.value = '';

    // Show typing indicator
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-message bot-message';
    typingDiv.textContent = 'Analyzing your query...';
    chatBody.appendChild(typingDiv);

    // Get response
    const response = await processUserMessage(message);
    
    // Remove typing indicator
    chatBody.removeChild(typingDiv);
    
    // Add response to chat
    addMessage(response);
}

// Handle Enter key press
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Initial check for API key



if (!MED_API_KEY || MED_API_KEY === 'YOUR_MED_API_KEY') {
    addMessage("⚠️ Please configure your API key to use this chat assistant.");
}

// Add script for CryptoJS (required for auth)
const script = document.createElement('script');
script.src = 'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js';
document.head.appendChild(script);

// Function to process user message and get health information
async function processUserMessage(message) {
    try {
        // Get auth token
        const token = await getAuthToken();
        if (!token) {
            throw new Error('Failed to get authentication token');
        }

        // Get symptoms list
        const symptoms = await getSymptoms(token);
        if (!symptoms || !Array.isArray(symptoms)) {
            throw new Error('Failed to fetch symptoms list');
        }

        // Basic symptom matching
        const userSymptoms = message.toLowerCase().split(/[,.]?\s+/);
        const matchedSymptoms = symptoms.filter(symptom => 
            userSymptoms.some(userWord => 
                symptom.Name.toLowerCase().includes(userWord)
            )
        );

        if (matchedSymptoms.length > 0) {
            // Get diagnosis for matched symptoms
            const diagnosisParams = new URLSearchParams({
                token: token,
                language: 'en-gb',
                symptoms: JSON.stringify(matchedSymptoms.map(s => s.ID)),
                gender: 'male',
                year_of_birth: '1990'
            });

            const diagnosisResponse = await fetch(`${DIAGNOSIS_API}?${diagnosisParams}`);
            if (!diagnosisResponse.ok) throw new Error('Failed to fetch diagnosis');
            
            const diagnosis = await diagnosisResponse.json();
            
            // Format response
            let healthInfo = 'Based on the symptoms you described:\n\n';
            if (diagnosis && diagnosis.length > 0) {
                diagnosis.slice(0, 3).forEach(d => {
                    healthInfo += `- Possible condition: ${d.Issue.Name}\n`;
                    healthInfo += `  Accuracy: ${Math.round(d.Issue.Accuracy)}%\n\n`;
                });
            } else {
                healthInfo = 'I could not determine a specific diagnosis for your symptoms.';
            }
            return healthInfo;
        } else {
            return 'I could not identify specific symptoms in your message. Please describe your symptoms more clearly.';
        }

    } catch (error) {
        console.error('Error processing message:', error);
        return 'Unable to fetch health information at the moment.';
    }
}
