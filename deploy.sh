#!/bin/bash

# LearnVerse EC2 Deployment Script
# Run this script on your EC2 instance to deploy the application

# 1. Update system and install dependencies
echo "Installing Node.js and dependencies..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2 serve

# 2. Setup Backend (Port 3000)
echo "Setting up Backend..."
cd AWS
npm install
cd ..

# 3. Setup Frontend (Port 3001)
echo "Setting up Frontend..."
cd learnverse_7
npm install
npm run build
cd ..

# 4. Start with PM2
echo "Starting services with PM2..."
pm2 start ecosystem.config.js

# 5. Save PM2 configuration to start on boot
pm2 startup
pm2 save

echo "=================================================="
echo "Deployment Complete!"
echo "Backend is running on Port 3000"
echo "Frontend is running on Port 3001"
echo "Make sure to open inbound rules for ports 3000 and 3001 in your EC2 Security Group."
echo "=================================================="
