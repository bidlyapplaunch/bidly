import nodemailer from 'nodemailer';

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.fromEmail = 'Auction System <noreply@auctions.com>';
    this.initialized = false;
  }

  // Lazy initialization - called when first used
  initialize() {
    if (this.initialized) return;
    
    // Debug environment variables
    console.log('🔍 Email Service Debug:');
    console.log('  - EMAIL_USER:', process.env.EMAIL_USER ? 'Present' : 'Missing');
    console.log('  - EMAIL_PASS:', process.env.EMAIL_PASS ? 'Present' : 'Missing');
    console.log('  - EMAIL_USER value:', process.env.EMAIL_USER || 'undefined');
    console.log('  - EMAIL_PASS length:', process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0);
    
    // Check if email is configured
    this.isConfigured = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
    
    if (this.isConfigured) {
      // Create transporter with real credentials
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
      console.log('📧 Email service configured with real credentials');
    } else {
      // Create transporter with demo credentials (will fail gracefully)
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'your-email@gmail.com',
          pass: 'your-app-password'
        }
      });
      console.log('📧 Email service running in DEMO mode (no real credentials)');
    }
    
    this.fromEmail = process.env.EMAIL_FROM || 'Auction System <noreply@auctions.com>';
    this.initialized = true;
  }

  // Demo mode - log email content instead of sending
  logEmailDemo(type, recipient, subject, content) {
    console.log('\n📧 ===== EMAIL NOTIFICATION (DEMO MODE) =====');
    console.log(`📬 Type: ${type}`);
    console.log(`📮 To: ${recipient}`);
    console.log(`📋 Subject: ${subject}`);
    console.log(`📄 Content: ${content.substring(0, 200)}...`);
    console.log('📧 ===========================================\n');
  }

  // Send bid confirmation email
  async sendBidConfirmation(bidderEmail, bidderName, auctionData, bidAmount) {
    const subject = `Bid Confirmation - ${auctionData.productData?.title || 'Auction Item'}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">🎯 Bid Confirmation</h2>
        
        <p>Hello ${bidderName},</p>
        
        <p>Your bid has been successfully placed!</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #2c3e50; margin-top: 0;">Auction Details</h3>
          <p><strong>Item:</strong> ${auctionData.productData?.title || 'Unknown Product'}</p>
          <p><strong>Your Bid:</strong> $${bidAmount}</p>
          <p><strong>Auction Ends:</strong> ${new Date(auctionData.endTime).toLocaleString()}</p>
          <p><strong>Current Status:</strong> ${auctionData.status}</p>
        </div>
        
        <p>You will be notified if someone outbids you or if you win the auction.</p>
        
        <p style="color: #7f8c8d; font-size: 14px;">
          Best regards,<br>
          The Bidly Team
        </p>
      </div>
    `;

    return this.sendEmail(bidderEmail, subject, html);
  }

  // Send auction won notification
  async sendAuctionWonNotification(bidderEmail, bidderName, auctionData, winningBid) {
    const subject = `🎉 You Won! - ${auctionData.productData?.title || 'Auction Item'}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #27ae60;">🎉 Congratulations! You Won!</h2>
        
        <p>Hello ${bidderName},</p>
        
        <p>Congratulations! You have won the auction!</p>
        
        <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #27ae60;">
          <h3 style="color: #155724; margin-top: 0;">Winning Details</h3>
          <p><strong>Item:</strong> ${auctionData.productData?.title || 'Unknown Product'}</p>
          <p><strong>Winning Bid:</strong> $${winningBid}</p>
          <p><strong>Auction Ended:</strong> ${new Date(auctionData.endTime).toLocaleString()}</p>
        </div>
        
        <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <h4 style="color: #856404; margin-top: 0;">Next Steps</h4>
          <p>Please complete your payment and arrange for item pickup/shipping within 48 hours.</p>
        </div>
        
        <p style="color: #7f8c8d; font-size: 14px;">
          Best regards,<br>
          The Bidly Team
        </p>
      </div>
    `;

    return this.sendEmail(bidderEmail, subject, html);
  }

  // Send outbid notification
  async sendOutbidNotification(bidderEmail, bidderName, auctionData, newHighestBid) {
    const subject = `⚠️ You've Been Outbid - ${auctionData.productData?.title || 'Auction Item'}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e74c3c;">⚠️ You've Been Outbid</h2>
        
        <p>Hello ${bidderName},</p>
        
        <p>Someone has placed a higher bid on the auction you were participating in.</p>
        
        <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e74c3c;">
          <h3 style="color: #721c24; margin-top: 0;">Auction Update</h3>
          <p><strong>Item:</strong> ${auctionData.productData?.title || 'Unknown Product'}</p>
          <p><strong>New Highest Bid:</strong> $${newHighestBid}</p>
          <p><strong>Time Remaining:</strong> ${this.getTimeRemaining(auctionData.endTime)}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3002'}" 
             style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Place a New Bid
          </a>
        </div>
        
        <p style="color: #7f8c8d; font-size: 14px;">
          Best regards,<br>
          The Bidly Team
        </p>
      </div>
    `;

    return this.sendEmail(bidderEmail, subject, html);
  }

  // Send auction ending soon notification
  async sendAuctionEndingSoon(bidderEmail, bidderName, auctionData, timeRemaining) {
    const subject = `⏰ Auction Ending Soon - ${auctionData.productData?.title || 'Auction Item'}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f39c12;">⏰ Auction Ending Soon!</h2>
        
        <p>Hello ${bidderName},</p>
        
        <p>The auction you're participating in is ending soon!</p>
        
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f39c12;">
          <h3 style="color: #856404; margin-top: 0;">Auction Details</h3>
          <p><strong>Item:</strong> ${auctionData.productData?.title || 'Unknown Product'}</p>
          <p><strong>Current Bid:</strong> $${auctionData.currentBid || auctionData.startingBid}</p>
          <p><strong>Time Remaining:</strong> ${timeRemaining}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3002'}" 
             style="background-color: #e74c3c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Place Your Final Bid
          </a>
        </div>
        
        <p style="color: #7f8c8d; font-size: 14px;">
          Best regards,<br>
          The Bidly Team
        </p>
      </div>
    `;

    return this.sendEmail(bidderEmail, subject, html);
  }

  // Send admin notification
  async sendAdminNotification(subject, message, auctionData = null) {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@auctions.com';
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">Admin Notification</h2>
        
        <p>${message}</p>
        
        ${auctionData ? `
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #2c3e50; margin-top: 0;">Auction Details</h3>
            <p><strong>Item:</strong> ${auctionData.productData?.title || 'Unknown Product'}</p>
            <p><strong>Status:</strong> ${auctionData.status}</p>
            <p><strong>Current Bid:</strong> $${auctionData.currentBid || 0}</p>
            <p><strong>Bid Count:</strong> ${auctionData.bidHistory?.length || 0}</p>
          </div>
        ` : ''}
        
        <p style="color: #7f8c8d; font-size: 14px;">
          Auction System Admin Panel
        </p>
      </div>
    `;

    return this.sendEmail(adminEmail, subject, html);
  }

  // Helper method to send email
  async sendEmail(to, subject, html) {
    // Initialize if not already done
    this.initialize();
    
    // Demo mode - just log the email content
    if (!this.isConfigured) {
      console.log('\n📧 ===== EMAIL NOTIFICATION (DEMO MODE) =====');
      console.log(`📮 To: ${to}`);
      console.log(`📋 Subject: ${subject}`);
      console.log(`📄 Content: ${html.substring(0, 200)}...`);
      console.log('📧 ===========================================\n');
      return { success: true, messageId: 'demo-mode', demo: true };
    }

    try {
      const mailOptions = {
        from: this.fromEmail,
        to: to,
        subject: subject,
        html: html
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Error sending email:', error);
      return { success: false, error: error.message };
    }
  }

  // Helper method to calculate time remaining
  getTimeRemaining(endTime) {
    const now = new Date();
    const end = new Date(endTime);
    const diff = end - now;
    
    if (diff <= 0) return 'Auction has ended';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  // Test email configuration
  async testEmailConfiguration() {
    try {
      await this.transporter.verify();
      console.log('✅ Email configuration is valid');
      return true;
    } catch (error) {
      console.error('❌ Email configuration error:', error);
      return false;
    }
  }
}

// Export singleton instance
export default new EmailService();
