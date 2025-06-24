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

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('📁 Created uploads directory:', uploadsDir);
}

// Fix for fetch in Node.js
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

// Serve uploaded images statically
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

// Add message to thread endpoint
app.post('/api/threads/:threadId/messages', async (req, res) => {
  try {
    const fetch = await getFetch();
    const { threadId } = req.params;
    const { content, attachments } = req.body;
    
    const messageData = {
      role: 'user',
      content
    };
    
    if (attachments) {
      messageData.attachments = attachments;
    }
    
    const response = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify(messageData)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
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
          },
          {
            type: "function",
            function: {
              name: "generate_career_visualization",
              description: "Generate a professional career visualization image based on career field. Only call this when the user explicitly agrees to see their future professional self.",
              parameters: {
                type: "object",
                properties: {
                  careerField: {
                    type: "string",
                    description: "The main career field (e.g., 'zorg', 'onderwijs', 'techniek', 'business', 'creativiteit', 'sport')",
                    enum: [
                      "zorg",
                      "onderwijs", 
                      "techniek",
                      "business",
                      "creativiteit",
                      "sport",
                      "recht",
                      "onderzoek",
                      "maatschappij"
                    ]
                  },
                  specificRole: {
                    type: "string",
                    description: "A more specific role if mentioned (e.g., 'doctor', 'teacher', 'engineer')"
                  },
                  userMessage: {
                    type: "string",
                    description: "A encouraging message to show the user while generating"
                  }
                },
                required: ["careerField"]
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

// Generate career visualization endpoint
app.post('/api/generate-career-visualization', async (req, res) => {
  try {
    const { careerField, specificRole, userMessage, threadId } = req.body;
    
    // Try to find the most recent uploaded image for THIS specific thread
    let uploadedImagePath = null;
    try {
      const files = fs.readdirSync(uploadsDir);
      let uploadFiles;
      
      if (threadId) {
        // Look for images from this specific thread first
        uploadFiles = files
          .filter(file => file.startsWith(`upload_${threadId}_`) && (file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png')))
          .map(file => ({
            name: file,
            time: fs.statSync(path.join(uploadsDir, file)).birthtime
          }))
          .sort((a, b) => b.time - a.time);
      }
      
      // If no thread-specific images found, fall back to any recent upload (for backward compatibility)
      if (!uploadFiles || uploadFiles.length === 0) {
        console.log('📸 No thread-specific image found, looking for any recent uploads...');
        uploadFiles = files
          .filter(file => file.startsWith('upload_') && (file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png')))
          .map(file => ({
            name: file,
            time: fs.statSync(path.join(uploadsDir, file)).birthtime
          }))
          .sort((a, b) => b.time - a.time);
      }
      
      if (uploadFiles.length > 0) {
        uploadedImagePath = path.join(uploadsDir, uploadFiles[0].name);
        console.log('📸 Found uploaded image:', uploadFiles[0].name);
      }
    } catch (error) {
      console.log('📸 No uploaded images found, will generate generic career image');
    }
    
    let response;
    
    if (uploadedImagePath && fs.existsSync(uploadedImagePath)) {
      // Use image editing to transform the uploaded photo - following the working logic
      console.log('🎨 Using uploaded image for career transformation');
      
      // Check if the image file exists (redundant but following the pattern)
      if (!fs.existsSync(uploadedImagePath)) {
        console.error(`Image file does not exist: ${uploadedImagePath}`);
        return res.status(500).json({ 
          success: false, 
          message: 'Uploaded image file not found' 
        });
      }
      
      // Create a transformation prompt based on career field
      let prompt = `Transform this person into a successful ${specificRole || careerField} professional. `;
      
      // Add field-specific details
      switch(careerField) {
        case 'zorg':
          prompt += 'Show them as a healthcare professional in medical attire, in a modern medical environment, confident and caring expression';
          break;
        case 'onderwijs':
          prompt += 'Show them as an educator in professional teaching attire, in a classroom setting, inspiring and knowledgeable expression';
          break;
        case 'techniek':
          prompt += 'Show them as a technology professional in smart casual attire, in a modern tech workspace, innovative and focused expression';
          break;
        case 'business':
          prompt += 'Show them as a business professional in formal business attire, in a corporate environment, confident and successful expression';
          break;
        case 'creativiteit':
          prompt += 'Show them as a creative professional in stylish attire, in an artistic studio workspace, inspiring and artistic expression';
          break;
        case 'sport':
          prompt += 'Show them as a sports professional in athletic professional wear, in a sports facility, energetic and healthy expression';
          break;
        case 'recht':
          prompt += 'Show them as a legal professional in formal business attire, in a law office setting, authoritative and trustworthy expression';
          break;
        case 'onderzoek':
          prompt += 'Show them as a research professional in professional attire, in a laboratory setting, intellectual and curious expression';
          break;
        case 'maatschappij':
          prompt += 'Show them as a social professional in professional attire, in a community environment, empathetic and engaged expression';
          break;
        default:
          prompt += 'Show them as a professional in their chosen field, in professional attire, confident and successful expression';
      }
      
      prompt += ', make the person about 20 years older. High quality professional photography, natural lighting, realistic';
      
      console.log('🎨 Career transformation prompt:', prompt);
      
      // Convert the image file to a format suitable for the OpenAI API - EXACTLY like the working script
      const imageType = uploadedImagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
      const image = await toFile(fs.createReadStream(uploadedImagePath), null, { type: imageType });
      
      // Use OpenAI image editing - EXACTLY like the working script
      response = await openai.images.edit({
        model: "gpt-image-1",
        image,
        prompt,
      });
      
      console.log('✅ OpenAI Image Edit completed successfully');
      
    } else {
      // Fallback to regular image generation if no uploaded image
      console.log('🎨 No uploaded image found, generating generic career image');
      
      let prompt = `Professional portrait of a successful ${specificRole || careerField} specialist. `;
      
      // Add field-specific details for generation
      switch(careerField) {
        case 'zorg':
          prompt += 'Healthcare professional in modern medical environment, confident and caring, wearing professional medical attire, warm lighting, approachable expression';
          break;
        case 'onderwijs':
          prompt += 'Educator in classroom or educational setting, inspiring and knowledgeable, professional teaching attire, bright educational environment';
          break;
        case 'techniek':
          prompt += 'Technology professional in modern tech workspace, innovative and focused, smart casual professional attire, modern office or lab setting';
          break;
        case 'business':
          prompt += 'Business professional in corporate environment, confident and successful, business professional attire, modern office setting';
          break;
        case 'creativiteit':
          prompt += 'Creative professional in artistic workspace, inspiring and artistic, stylish professional attire, creative studio environment';
          break;
        case 'sport':
          prompt += 'Sports professional in athletic environment, energetic and healthy, athletic professional wear, sports facility or outdoor setting';
          break;
        case 'recht':
          prompt += 'Legal professional in law office, authoritative and trustworthy, formal business attire, professional law office setting';
          break;
        case 'onderzoek':
          prompt += 'Research professional in laboratory or academic setting, intellectual and curious, professional research attire, modern research facility';
          break;
        case 'maatschappij':
          prompt += 'Social professional in community setting, empathetic and engaged, professional social work attire, community or office environment';
          break;
        default:
          prompt += 'Professional in their chosen field, confident and successful, professional attire, modern workplace';
      }
      
      prompt += ', high quality professional photography, natural lighting, realistic, detailed';
      
      response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        response_format: "b64_json"
      });
    }
    
    // Handle response - EXACTLY like the working script
    if (!response.data || response.data.length === 0) {
      console.error('No image returned from OpenAI API');
      return res.status(500).json({ 
        success: false, 
        message: 'No image returned from OpenAI API' 
      });
    }

    const image_base64 = response.data[0].b64_json;
    if (!image_base64) {
      console.error('No base64 image data returned from OpenAI API');
      console.debug(response);
      return res.status(500).json({ 
        success: false, 
        message: 'No base64 image data returned from OpenAI API' 
      });
    }

    // Save image to uploads folder - EXACTLY like the working script
    const timestamp = Date.now();
    const filename = `career_${careerField}_${timestamp}.png`;
    const filepath = path.join(uploadsDir, filename);
    
    const image_bytes = Buffer.from(image_base64, "base64");
    fs.writeFileSync(filepath, image_bytes);
    
    console.log('💾 Career visualization saved:', filepath);
    
    const dataUrl = `data:image/png;base64,${image_base64}`;
    const serverUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
    
    return res.json({ 
      success: true,
      careerImageUrl: dataUrl,
      serverUrl: serverUrl,
      filename: filename,
      careerField: careerField,
      specificRole: specificRole || careerField,
      message: userMessage || 'Career visualization generated successfully!',
      usedUploadedImage: !!uploadedImagePath
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
      success: false, 
      message: errorMessage,
      error: error.message 
    });
  }
});

// Generate image endpoint (for OpenAI DALL-E)
app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      response_format: "b64_json"
    });
    
    if (response.data && response.data[0] && response.data[0].b64_json) {
      const base64Image = response.data[0].b64_json;
      
      // Save image to uploads folder
      const timestamp = Date.now();
      const filename = `dalle_${timestamp}.png`;
      const filepath = path.join(uploadsDir, filename);
      
      const imageBuffer = Buffer.from(base64Image, 'base64');
      fs.writeFileSync(filepath, imageBuffer);
      
      console.log('💾 DALL-E image saved:', filepath);
      
      const dataUrl = `data:image/png;base64,${base64Image}`;
      const serverUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
      
      return res.json({ 
        type: 'base64', 
        data: dataUrl,
        serverUrl: serverUrl,
        filename: filename
      });
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
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    console.log('📁 File received:', req.file.originalname, req.file.mimetype, req.file.size);
    
    // Get threadId from query params if available
    const threadId = req.query.threadId || 'unknown';
    
    // Save file to uploads folder with thread ID prefix
    const timestamp = Date.now();
    const filename = `upload_${threadId}_${timestamp}_${req.file.originalname}`;
    const filepath = path.join(uploadsDir, filename);
    
    fs.writeFileSync(filepath, req.file.buffer);
    console.log('💾 File saved locally:', filepath);
    
    // Upload to OpenAI using the OpenAI client
    const fileStream = fs.createReadStream(filepath);
    const uploadResponse = await openai.files.create({
      file: fileStream,
      purpose: 'assistants'
    });
    
    console.log('📁 OpenAI file upload response:', uploadResponse);
    
    // Return both OpenAI file ID and local server URL
    res.json({
      ...uploadResponse,
      localUrl: `${req.protocol}://${req.get('host')}/uploads/${filename}`,
      localFilename: filename,
      threadId: threadId
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// List all saved images endpoint
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
  console.log('Assistant ID:', process.env.ASSISTANT_ID ? 'Configured ✅' : 'Missing ❌');
  console.log('Uploads directory:', uploadsDir);
});