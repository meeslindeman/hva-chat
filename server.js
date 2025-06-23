const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const OpenAI = require('openai');
const { toFile } = require('openai');
const fs = require('fs');
require('dotenv').config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// CREATE UPLOADS DIRECTORY IF IT DOESN'T EXIST
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('📁 Created uploads directory:', uploadsDir);
}

// Fix for fetch in Node.js
let fetch;
(async () => {
  if (typeof globalThis.fetch === 'undefined') {
    const { default: nodeFetch } = await import('node-fetch');
    fetch = nodeFetch;
  } else {
    fetch = globalThis.fetch;
  }
})();

async function getFetch() {
  if (typeof globalThis.fetch !== 'undefined') {
    return globalThis.fetch;
  }
  const { default: nodeFetch } = await import('node-fetch');
  return nodeFetch;
}

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// SERVE UPLOADED IMAGES STATICALLY
app.use('/uploads', express.static(uploadsDir));

// Create thread endpoint
app.post('/api/threads', async (req, res) => {
  try {
    const fetch = await getFetch();
    
    const response = await fetch('https://api.openai.com/v1/threads', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Thread creation error:', error);
    res.status(500).json({ error: 'Failed to create thread' });
  }
});

async function getMessageReply(threadId, content, attachments) {
  const messageData = {
    role: 'user',
    content
  };
  if (attachments) {
    messageData.attachments = attachments;
  }
  return fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify(messageData)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
} 

// Add message to thread endpoint
app.post('/api/threads/:threadId/messages', async (req, res) => {
  try {
    const { threadId } = req.params;
    const { content, attachments } = req.body;
    const data = await getMessageReply(threadId, content, attachments);
    res.json(data);
  } catch (error) {
    console.error('Message addition error:', error);
    res.status(500).json({ error: 'Failed to add message to thread' });
  }
});

// Run assistant endpoint
app.post('/api/threads/:threadId/runs', async (req, res) => {
  try {
    const fetch = await getFetch();
    const { threadId } = req.params;
    
    const response = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        assistant_id: process.env.ASSISTANT_ID,
        tools: [
          {
            type: "file_search"
          },
          {
            type: "code_interpreter"
          },
          {
            type: "function",
            function: {
              name: "generate_image",
              description: "Generate an image using DALL-E based on a text prompt",
              parameters: {
                type: "object",
                properties: {
                  prompt: {
                    type: "string",
                    description: "Detailed description of the image to generate"
                  }
                },
                required: ["prompt"]
              }
            }
          }
        ]
      })
    });
    
    const data = await response.json();
    console.log('Assistant run created:', data);
    res.json(data);
  } catch (error) {
    console.error('Run creation error:', error);
    res.status(500).json({ error: 'Failed to create run' });
  }
});

// Check run status endpoint
app.get('/api/threads/:threadId/runs/:runId', async (req, res) => {
  try {
    const fetch = await getFetch();
    const { threadId, runId } = req.params;
    
    const response = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Run status error:', error);
    res.status(500).json({ error: 'Failed to get run status' });
  }
});

// Submit tool outputs endpoint
app.post('/api/threads/:threadId/runs/:runId/submit_tool_outputs', async (req, res) => {
  try {
    const fetch = await getFetch();
    const { threadId, runId } = req.params;
    const { tool_outputs } = req.body;
    
    const response = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}/submit_tool_outputs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({ tool_outputs })
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Tool outputs error:', error);
    res.status(500).json({ error: 'Failed to submit tool outputs' });
  }
});

// Get messages endpoint
app.get('/api/threads/:threadId/messages', async (req, res) => {
  try {
    const fetch = await getFetch();
    const { threadId } = req.params;
    
    const response = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Messages retrieval error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// Generate image endpoint (for OpenAI DALL-E)
app.post('/api/generate-image', async (req, res) => {
  try {
    const fetch = await getFetch();
    const { prompt } = req.body;
    
    const requestBody = {
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      response_format: "b64_json"
    };
    
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('DALL-E API error:', errorText);
      return res.status(response.status).json({ error: 'Failed to generate image' });
    }
    
    const data = await response.json();
    
    if (data.data && data.data[0] && data.data[0].b64_json) {
      const base64Image = data.data[0].b64_json;
      const dataUrl = `data:image/png;base64,${base64Image}`;
      return res.json({ type: 'base64', data: dataUrl });
    }
    
    res.status(500).json({ error: 'No image data in response' });
  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({ error: 'Failed to generate image' });
  }
});

// File upload endpoint
app.post('/api/upload-file', upload.single('file'), async (req, res) => {
  try {
    const fetch = await getFetch();
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    console.log('📁 File received:', req.file.originalname, req.file.mimetype, req.file.size);
    
    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });
    formData.append('purpose', 'assistants');
    
    const response = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        ...formData.getHeaders()
      },
      body: formData
    });
    
    const data = await response.json();
    console.log('📁 OpenAI file upload response:', data);
    res.json(data);
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Helper function to convert base64 to buffer and create a File-like object
function base64ToFile(base64Data, filename = 'image.png') {
  // Remove data URL prefix if present
  const base64String = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
  const buffer = Buffer.from(base64String, 'base64');
  
  // Create a File-like object that OpenAI expects
  return {
    buffer,
    name: filename,
    type: filename.endsWith('.png') ? 'image/png' : 'image/jpeg'
  };
}

// Face aging route using OpenAI Image Editing API - NOW WITH FILE STORAGE
app.post('/api/age-face/:threadId', async (req, res) => {
    try {
        const { imageBase64, ageTarget = 50 } = req.body;
        
        console.log('👴 Aging face using OpenAI Image Editing API, target age:', ageTarget);
        
        // Ensure that the OPENAI_API_KEY is set
        if (!process.env.OPENAI_API_KEY) {
            console.error('OPENAI_API_KEY is not set in the environment variables');
            return res.status(500).json({ error: 'OpenAI API key not configured' });
        }
        
        // Remove data URL prefix if present
        const base64String = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
        const imageBuffer = Buffer.from(base64String, 'base64');
        
        // SAVE ORIGINAL IMAGE TO SERVER
        const timestamp = Date.now();
        const originalFilename = `original_${timestamp}.png`;
        const originalPath = path.join(uploadsDir, originalFilename);
        
        fs.writeFileSync(originalPath, imageBuffer);
        console.log('💾 Original image saved:', originalPath);
        
        console.log('🎨 Running OpenAI Image Edit...');
        
        // Create the aging prompt
        const { threadId } = req.params
        const reply = await getMessageReply(threadId, 'Kun je een promt maken die op basis van deze chat vraagt om een foto te maken van mij als ik ouder ben? Ik wil geen uitleg, alleen de prompt.', );
        // hier even uitzoekeen wat de repsonse structuur van de reply is, deze regel klopt misschien niet:
        const prompt = reply.choices[0].message.content;

        console.log(`🎯 Using prompt: ${prompt}`);

        // Convert the image buffer to a format suitable for the OpenAI API
        const imageType = 'image/png';
        const image = await toFile(imageBuffer, 'image.png', { type: imageType });

        // Use OpenAI's image editing API
        const response = await openai.images.edit({
            model: "gpt-image-1",
            image,
            prompt,
        });

        console.log('✅ OpenAI Image Edit completed successfully');
        
        if (!response.data || response.data.length === 0) {
            console.error('No image returned from OpenAI API');
            return res.status(500).json({ 
                error: 'OpenAI image editing failed',
                message: 'No image returned from OpenAI API'
            });
        }

        // Handle response
        const image_base64 = response.data[0].b64_json;
        if (!image_base64) {
            console.error('No base64 image data returned from OpenAI API');
            return res.status(500).json({ 
                error: 'OpenAI image editing failed',
                message: 'No base64 image data returned from OpenAI API'
            });
        }

        // SAVE AGED IMAGE TO SERVER
        const agedImageBuffer = Buffer.from(image_base64, 'base64');
        const agedFilename = `aged_${timestamp}.png`;
        const agedPath = path.join(uploadsDir, agedFilename);
        
        fs.writeFileSync(agedPath, agedImageBuffer);
        console.log('💾 Aged image saved:', agedPath);

        // Convert to data URL format for web usage
        const dataUrl = `data:image/png;base64,${image_base64}`;
        
        // Also provide server URLs for the saved files
        const originalUrl = `${req.protocol}://${req.get('host')}/uploads/${originalFilename}`;
        const agedUrl = `${req.protocol}://${req.get('host')}/uploads/${agedFilename}`;
        
        console.log('🖼️ Successfully generated and saved aged image');
        console.log('📍 Original image URL:', originalUrl);
        console.log('📍 Aged image URL:', agedUrl);
        
        res.json({
            success: true,
            agedImageUrl: dataUrl, // Base64 for immediate display
            agedImageServerUrl: agedUrl, // Server URL for permanent access
            originalImageServerUrl: originalUrl, // Original image URL
            model: 'gpt-image-1',
            targetAge: ageTarget,
            description: `Aged to ${ageTarget} years old - your future career self!`,
            savedFiles: {
                original: originalFilename,
                aged: agedFilename
            }
        });
        
    } catch (error) {
        console.error('❌ Error with OpenAI Image Editing:', error);
        
        // Handle specific OpenAI API errors
        let errorMessage = 'The image editing AI model is currently unavailable. Please try again later.';
        
        if (error.code === 'invalid_request_error') {
            errorMessage = 'Invalid image format. Please use a clear photo with a person facing the camera.';
        } else if (error.code === 'rate_limit_exceeded') {
            errorMessage = 'Too many requests. Please wait a moment and try again.';
        } else if (error.message?.includes('content_policy_violation')) {
            errorMessage = 'Image content not suitable for editing. Please use a different photo.';
        } else if (error.type === 'image_generation_user_error') {
            errorMessage = 'Image format or content not suitable for editing. Please try with a different, clearer photo.';
        }
        
        res.status(500).json({ 
            error: 'OpenAI image editing failed',
            message: errorMessage,
            details: error.message 
        });
    }
});

// NEW ENDPOINT: List all saved images
app.get('/api/saved-images', (req, res) => {
    try {
        const files = fs.readdirSync(uploadsDir);
        const imageFiles = files.filter(file => 
            file.toLowerCase().endsWith('.png') || 
            file.toLowerCase().endsWith('.jpg') || 
            file.toLowerCase().endsWith('.jpeg')
        );
        
        const imageList = imageFiles.map(filename => ({
            filename,
            url: `${req.protocol}://${req.get('host')}/uploads/${filename}`,
            created: fs.statSync(path.join(uploadsDir, filename)).birthtime
        }));
        
        res.json({ images: imageList });
    } catch (error) {
        console.error('Error listing images:', error);
        res.status(500).json({ error: 'Failed to list images' });
    }
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('OpenAI Assistant ready!');
  console.log('OpenAI API Key:', process.env.OPENAI_API_KEY ? 'Configured ✅' : 'Missing ❌');
  console.log('Using OpenAI Image Editing API (DALL-E 2 edit endpoint)');
  console.log('Uploads directory:', uploadsDir);
});