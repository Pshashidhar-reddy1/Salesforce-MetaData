const axios = require('axios');

// Test configuration
const API_BASE_URL = 'http://localhost:3000';
const TEST_ORG_ALIAS = 'your-org-alias'; // Replace with your actual org alias

// Sample test data
const testData = {
    objectName: "Beat_Plan",
    orgAlias: TEST_ORG_ALIAS,
    fields: [
        {
            name: "Location",
            label: "Location",
            type: "Text"
        },
        {
            name: "Date",
            label: "Date",
            type: "Date"
        },
        {
            name: "Notes",
            label: "Notes",
            type: "TextArea"
        },
        {
            name: "Priority",
            label: "Priority",
            type: "Picklist"
        },
        {
            name: "Is_Active",
            label: "Is Active",
            type: "Checkbox"
        },
        {
            name: "Contact_Email",
            label: "Contact Email",
            type: "Email"
        },
        {
            name: "Phone_Number",
            label: "Phone Number",
            type: "Phone"
        }
    ]
};

async function testHealthCheck() {
    try {
        console.log('🔍 Testing health check...');
        const response = await axios.get(`${API_BASE_URL}/health`);
        console.log('✅ Health check passed:', response.data);
        return true;
    } catch (error) {
        console.error('❌ Health check failed:', error.message);
        return false;
    }
}

async function testCreateMetadata() {
    try {
        console.log('\n🚀 Testing metadata creation...');
        console.log('📋 Creating object:', testData.objectName);
        console.log('📊 Fields:', testData.fields.map(f => `${f.name} (${f.type})`).join(', '));
        
        const response = await axios.post(`${API_BASE_URL}/create-metadata`, testData, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 60000 // 60 second timeout for deployment
        });
        
        console.log('✅ Metadata creation successful!');
        console.log('📤 Response:', response.data.message);
        console.log('🔧 Object created:', response.data.objectName);
        console.log('📊 Fields created:', response.data.fields.length);
        
        return true;
    } catch (error) {
        console.error('❌ Metadata creation failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Error:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
        return false;
    }
}

async function runTests() {
    console.log('🧪 Starting API Tests...\n');
    
    // Test 1: Health Check
    const healthCheckPassed = await testHealthCheck();
    
    if (!healthCheckPassed) {
        console.log('\n❌ Health check failed. Make sure the API server is running.');
        console.log('💡 Run: npm start or npm run dev');
        return;
    }
    
    // Test 2: Create Metadata
    await testCreateMetadata();
    
    console.log('\n🏁 Tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { testHealthCheck, testCreateMetadata, runTests }; 