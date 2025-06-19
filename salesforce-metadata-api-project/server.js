const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const port = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());

// Middleware to parse JSON bodies
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'Salesforce Metadata API is running' });
});

// POST request to create Salesforce metadata
app.post('/create-metadata', async (req, res) => {
    try {
        const { objectName, fields, orgAlias } = req.body;

        // Validate required fields
        if (!objectName || !fields || !Array.isArray(fields)) {
            return res.status(400).json({ 
                error: "Bad Request", 
                message: "Object name and fields array are required" 
            });
        }

        if (!orgAlias) {
            return res.status(400).json({ 
                error: "Bad Request", 
                message: "orgAlias is required" 
            });
        }

        // Validate field structure
        for (let field of fields) {
            if (!field.name || !field.label || !field.type) {
                return res.status(400).json({ 
                    error: "Bad Request", 
                    message: "Each field must have name, label, and type properties" 
                });
            }
        }

        console.log(`Creating metadata for object: ${objectName}`);

        // Create metadata directory structure
        const metadataDir = './mdapioutput';
        const objectDir = path.join(metadataDir, 'unpackaged', 'objects');
        
        // Clean up existing directory
        if (fs.existsSync(metadataDir)) {
            fs.rmSync(metadataDir, { recursive: true, force: true });
        }
        
        // Create directories
        fs.mkdirSync(objectDir, { recursive: true });

        // Create XML for the custom object
        const objectMetadata = generateObjectMetadata(objectName, fields);
        
        // Write object metadata file
        const objectFilePath = path.join(objectDir, `${objectName}__c.object-meta.xml`);
        fs.writeFileSync(objectFilePath, objectMetadata);

        // Create fields metadata
        const fieldsMetadata = generateFieldsMetadata(fields);
        const fieldsFilePath = path.join(objectDir, `${objectName}__c.fields-meta.xml`);
        fs.writeFileSync(fieldsFilePath, fieldsMetadata);

        // Create package.xml
        const packageXml = generatePackageXml(objectName);
        const packagePath = path.join(metadataDir, 'unpackaged', 'package.xml');
        fs.writeFileSync(packagePath, packageXml);

        console.log('Metadata files created successfully');

        // Deploy using Salesforce CLI
        const deployCommand = `sfdx force:mdapi:deploy -d ${metadataDir}/unpackaged -u ${orgAlias} --wait 10 --verbose`;
        
        exec(deployCommand, (error, stdout, stderr) => {
            if (error) {
                console.error('Deployment error:', error);
                return res.status(500).json({ 
                    error: "Deployment Failed", 
                    message: stderr || error.message,
                    details: stdout
                });
            }
            
            console.log('Deployment successful:', stdout);
            res.status(200).json({ 
                message: 'Metadata created and deployed successfully', 
                objectName: objectName,
                fields: fields,
                output: stdout 
            });
        });

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ 
            error: "Internal Server Error", 
            message: error.message 
        });
    }
});

// Serve all static files (including swagger.yaml) from the project root
app.use(express.static(__dirname));

// Helper function to generate object metadata XML
function generateObjectMetadata(objectName, fields) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>${objectName}__c</fullName>
    <label>${objectName}</label>
    <pluralLabel>${objectName}s</pluralLabel>
    <nameField>
        <type>AutoNumber</type>
        <label>${objectName} Number</label>
        <displayFormat>${objectName}-{0000}</displayFormat>
    </nameField>
    <sharingModel>ReadWrite</sharingModel>
    <enableSharing>true</enableSharing>
    <enableBulkApi>true</enableBulkApi>
    <enableStreamingApi>true</enableStreamingApi>
    <enableReports>true</enableReports>
    <enableSearch>true</enableSearch>
    <enableHistory>false</enableHistory>
    <enableActivities>true</enableActivities>
    <deploymentStatus>Deployed</deploymentStatus>
</CustomObject>`;
}

// Helper function to generate fields metadata XML
function generateFieldsMetadata(fields) {
    const fieldElements = fields.map(field => {
        const fieldType = getFieldType(field.type);
        const fieldXml = generateFieldXml(field, fieldType);
        return fieldXml;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
${fieldElements}
</CustomObject>`;
}

// Helper function to generate individual field XML
function generateFieldXml(field, fieldType) {
    const baseXml = `    <fields>
        <fullName>${field.name}__c</fullName>
        <label>${field.label}</label>
        <type>${fieldType}</type>`;

    switch (fieldType) {
        case 'Text':
            return `${baseXml}
        <length>255</length>
        <required>false</required>
    </fields>`;
        
        case 'TextArea':
            return `${baseXml}
        <length>32768</length>
        <visibleLines>3</visibleLines>
        <required>false</required>
    </fields>`;
        
        case 'Date':
            return `${baseXml}
        <required>false</required>
    </fields>`;
        
        case 'DateTime':
            return `${baseXml}
        <required>false</required>
    </fields>`;
        
        case 'Number':
            return `${baseXml}
        <precision>18</precision>
        <scale>0</scale>
        <required>false</required>
    </fields>`;
        
        case 'Checkbox':
            return `${baseXml}
        <defaultValue>false</defaultValue>
    </fields>`;
        
        case 'Picklist':
            return `${baseXml}
        <valueSet>
            <restricted>true</restricted>
            <valueSetDefinition>
                <sorted>false</sorted>
                <value>
                    <fullName>Option 1</fullName>
                    <default>false</default>
                    <label>Option 1</label>
                </value>
                <value>
                    <fullName>Option 2</fullName>
                    <default>false</default>
                    <label>Option 2</label>
                </value>
            </valueSetDefinition>
        </valueSet>
        <required>false</required>
    </fields>`;
        
        default:
            return `${baseXml}
        <length>255</length>
        <required>false</required>
    </fields>`;
    }
}

// Helper function to map field types
function getFieldType(type) {
    const typeMap = {
        'Text': 'Text',
        'TextArea': 'TextArea',
        'Date': 'Date',
        'DateTime': 'DateTime',
        'Number': 'Number',
        'Checkbox': 'Checkbox',
        'Picklist': 'Picklist',
        'Email': 'Email',
        'Phone': 'Phone',
        'URL': 'Url'
    };
    
    return typeMap[type] || 'Text';
}

// Helper function to generate package.xml
function generatePackageXml(objectName) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>${objectName}__c</members>
        <name>CustomObject</name>
    </types>
    <version>58.0</version>
</Package>`;
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: "Internal Server Error", 
        message: "Something went wrong!" 
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        error: "Not Found", 
        message: "Endpoint not found" 
    });
});

// Start the API server
app.listen(port, () => {
    console.log(`🚀 Salesforce Metadata API server running at http://localhost:${port}`);
    console.log(`📋 Health check: http://localhost:${port}/health`);
    console.log(`📤 Create metadata: POST http://localhost:${port}/create-metadata`);
}); 