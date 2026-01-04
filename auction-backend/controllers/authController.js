import User from '../models/User.js';
import { AppError } from '../middleware/errorHandler.js';
import { generateToken } from '../middleware/auth.js';
import emailService from '../services/emailService.js';

// Register new user
export const register = async (req, res, next) => {
  try {
    console.log('📝 Registration request received:', {
      email: req.body.email,
      name: req.body.name,
      role: req.body.role,
      hasPassword: !!req.body.password,
      passwordLength: req.body.password?.length
    });

    const { email, password, name, role = 'customer' } = req.body;

    // Validate required fields
    if (!email) {
      throw new AppError('Email is required', 400);
    }
    if (!password) {
      throw new AppError('Password is required', 400);
    }
    if (password.length < 6) {
      throw new AppError('Password must be at least 6 characters', 400);
    }
    if (!name || !name.trim()) {
      throw new AppError('Name is required', 400);
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError('User already exists with this email.', 400);
    }

    // Create new user
    const user = new User({
      email,
      password,
      name,
      role
    });

    await user.save();

    // NOTE: JWT tokens are ONLY for the separate admin app (auction-admin), NOT for the Shopify embedded app.
    // The Shopify app uses Shopify session tokens (RS256) via authenticatedFetch, not backend JWTs (HS256).
    // Generate token
    const token = generateToken(user._id);

    // Send welcome email
    try {
      await emailService.sendAdminNotification(
        req.shopDomain,
        'New User Registration',
        `New user registered: ${name} (${email}) with role: ${role}`,
        null
      );
    } catch (emailError) {
      console.error('Welcome email failed:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: user.toJSON(),
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

// Login user
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      throw new AppError('Invalid email or password.', 401);
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AppError('Account is deactivated.', 401);
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password.', 401);
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // NOTE: JWT tokens are ONLY for the separate admin app (auction-admin), NOT for the Shopify embedded app.
    // The Shopify app uses Shopify session tokens (RS256) via authenticatedFetch, not backend JWTs (HS256).
    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.toJSON(),
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get current user profile
export const getProfile = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: req.user
    });
  } catch (error) {
    next(error);
  }
};

// Update user profile
export const updateProfile = async (req, res, next) => {
  try {
    const { name, email } = req.body;
    const userId = req.user._id;

    // Check if email is already taken by another user
    if (email && email !== req.user.email) {
      const existingUser = await User.findOne({ email, _id: { $ne: userId } });
      if (existingUser) {
        throw new AppError('Email already in use.', 400);
      }
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: user.toJSON()
    });
  } catch (error) {
    next(error);
  }
};

// Change password
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      throw new AppError('Current password is incorrect.', 400);
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Create default admin user (for initial setup)
export const createDefaultAdmin = async (req, res, next) => {
  try {
    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      throw new AppError('Admin user already exists.', 400);
    }

    const admin = new User({
      email: process.env.ADMIN_EMAIL || 'admin@auctions.com',
      password: process.env.ADMIN_PASSWORD || 'admin123',
      name: 'System Administrator',
      role: 'admin'
    });

    await admin.save();

    res.status(201).json({
      success: true,
      message: 'Default admin user created successfully',
      data: {
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    next(error);
  }
};

// Logout (client-side token removal)
export const logout = async (req, res, next) => {
  try {
    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    next(error);
  }
};
