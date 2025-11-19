export const EMAIL_TEMPLATE_KEYS = [
  'bidConfirmation',
  'outbidNotification',
  'winnerNotification',
  'auctionEndingSoon',
  'adminNotification'
];

const BID_CONFIRMATION_HTML = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2c3e50;">🎯 Bid Confirmation</h2>
    <p>Hello {{display_name}},</p>
    <p>Your bid has been successfully placed on {{auction_title}}.</p>
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="color: #2c3e50; margin-top: 0;">Auction Details</h3>
      <p><strong>Item:</strong> {{auction_title}}</p>
      <p><strong>Your Bid:</strong> {{bid_amount}}</p>
      <p><strong>Auction Ends:</strong> {{auction_end_time}}</p>
      <p><strong>Current Status:</strong> {{auction_status}}</p>
    </div>
    <p>We will notify you if someone outbids you or if you win the auction.</p>
    <p style="color: #7f8c8d; font-size: 14px;">
      Best regards,<br>
      {{store_name}} Team
    </p>
  </div>
`;

const OUTBID_HTML = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #e74c3c;">⚠️ You've Been Outbid</h2>
    <p>Hello {{display_name}},</p>
    <p>Someone just placed a higher bid on {{auction_title}}.</p>
    <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e74c3c;">
      <h3 style="color: #721c24; margin-top: 0;">Auction Update</h3>
      <p><strong>Item:</strong> {{auction_title}}</p>
      <p><strong>New Highest Bid:</strong> {{current_bid}}</p>
      <p><strong>Time Remaining:</strong> {{time_remaining}}</p>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{cta_url}}"
         style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
        Place a new bid
      </a>
    </div>
    <p style="color: #7f8c8d; font-size: 14px;">
      Best regards,<br>
      {{store_name}} Team
    </p>
  </div>
`;

const WINNER_HTML = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #27ae60;">🎉 You Won the Auction!</h2>
    <p>Dear {{display_name}},</p>
    <p>Congratulations! You won the auction for <strong>{{auction_title}}</strong> with a winning bid of <strong>{{winning_bid}}</strong>.</p>
    <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #27ae60;">
      <h3 style="color: #155724; margin-top: 0;">Winning Details</h3>
      <p><strong>Product:</strong> {{product_title}}</p>
      <p><strong>Winning Bid:</strong> {{winning_bid}}</p>
      <p><strong>Auction Ended:</strong> {{auction_end_time}}</p>
    </div>
    <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
      <h3 style="color: #856404; margin-top: 0;">📧 Next Steps</h3>
      <p>An invoice with payment instructions will arrive shortly. Please follow the link in that email to claim your win.</p>
    </div>
    <p style="color: #7f8c8d; font-size: 14px;">
      Best regards,<br>
      {{store_name}} Team
    </p>
  </div>
`;

const ENDING_SOON_HTML = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #f39c12;">⏰ Auction Ending Soon!</h2>
    <p>Hello {{display_name}},</p>
    <p>The auction for {{auction_title}} is ending soon. Don't miss your chance to win!</p>
    <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f39c12;">
      <h3 style="color: #856404; margin-top: 0;">Auction Details</h3>
      <p><strong>Item:</strong> {{auction_title}}</p>
      <p><strong>Current Bid:</strong> {{current_bid}}</p>
      <p><strong>Time Remaining:</strong> {{time_remaining}}</p>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{cta_url}}"
         style="background-color: #e74c3c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
        Place your final bid
      </a>
    </div>
    <p style="color: #7f8c8d; font-size: 14px;">
      Best regards,<br>
      {{store_name}} Team
    </p>
  </div>
`;

const ADMIN_HTML = `
  <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
    <h2 style="color: #2c3e50;">Admin Notification</h2>
    <p>{{admin_message}}</p>
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="color: #2c3e50; margin-top: 0;">Auction Snapshot</h3>
      <p><strong>Store:</strong> {{store_name}}</p>
      <p><strong>Auction:</strong> {{auction_title}}</p>
      <p><strong>Status:</strong> {{auction_status}}</p>
      <p><strong>Current Bid:</strong> {{current_bid}}</p>
      <p><strong>Bid Count:</strong> {{bid_count}}</p>
    </div>
    <p style="color: #7f8c8d; font-size: 14px;">
      Bidly Admin Panel
    </p>
  </div>
`;

export const DEFAULT_EMAIL_TEMPLATES = Object.freeze({
  bidConfirmation: {
    subject: 'Your bid on {{auction_title}} has been received',
    html: BID_CONFIRMATION_HTML
  },
  outbidNotification: {
    subject: 'You have been outbid on {{auction_title}}',
    html: OUTBID_HTML
  },
  winnerNotification: {
    subject: 'You won the auction for {{auction_title}}!',
    html: WINNER_HTML
  },
  auctionEndingSoon: {
    subject: '{{auction_title}} is ending soon',
    html: ENDING_SOON_HTML
  },
  adminNotification: {
    subject: 'Admin update for {{auction_title}}',
    html: ADMIN_HTML
  }
});

const EMPTY_TEMPLATE = Object.freeze({
  enabled: true,
  subject: '',
  html: ''
});

function buildDefaultTemplatesConfig() {
  return EMAIL_TEMPLATE_KEYS.reduce((acc, key) => {
    acc[key] = { ...EMPTY_TEMPLATE };
    return acc;
  }, {});
}

export const DEFAULT_EMAIL_SETTINGS = Object.freeze({
  enabled: true,
  useCustomSmtp: false,
  smtp: {
    host: '',
    port: null,
    secure: false,
    user: '',
    pass: '',
    fromName: '',
    fromEmail: ''
  },
  templates: buildDefaultTemplatesConfig()
});

export function cloneDefaultEmailSettings() {
  return JSON.parse(JSON.stringify(DEFAULT_EMAIL_SETTINGS));
}

