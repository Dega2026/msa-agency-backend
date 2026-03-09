require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/db');
const User = require('./models/User');
const Settings = require('./models/Settings');
const Success = require('./models/Success');
const Partner = require('./models/Partner');
const Plan = require('./models/Plan');
const { authMiddleware, checkRole } = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 10000;
const webRoot = path.resolve(__dirname, '..');

app.use(cors());
app.use(express.json());

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        sub: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    return res.json({
      token,
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'msa-agency-backend' });
});

app.get('/api/users', async (_req, res) => {
  const users = await User.find({}, { password: 0 }).sort({ createdAt: -1 });
  res.json(users);
});

app.get('/api/settings/public', async (_req, res) => {
  const settings = await Settings.findOne().sort({ createdAt: -1 });
  const defaultEn =
    "2026 MSA Agency. Engineered & Designed by <a href='../profiles/amr.html' class='founder-sig'>Amr Eladly</a>";
  const defaultAr =
    "2026 وكالة MSA. تم التصميم والهندسة بواسطة <a href='../profiles/amr.html' class='founder-sig'>م. عمرو العدلي</a>";

  const isLikelyCorrupted = (value) => {
    if (typeof value !== 'string') return true;
    const text = value.trim();
    if (!text) return true;
    return /\?{3,}|�/.test(text);
  };

  const footerSigEn = settings?.footer_sig_en || settings?.footerSignature;
  const footerSigAr = settings?.footer_sig_ar;

  res.json({
    footer_sig_en: isLikelyCorrupted(footerSigEn) ? defaultEn : footerSigEn,
    footer_sig_ar: isLikelyCorrupted(footerSigAr) ? defaultAr : footerSigAr,
    founder_title: settings?.founder_title || 'Founder & Chief Architect',
    globalAlert: settings?.globalAlert || '',
  });
});

app.get('/api/settings', async (_req, res) => {
  const settings = await Settings.findOne().sort({ createdAt: -1 });
  res.json(settings || null);
});

app.get('/api/founder-signature', async (_req, res) => {
  const settings = await Settings.findOne().sort({ createdAt: -1 });
  const signature =
    settings?.footer_sig_en ||
    settings?.footerSignature ||
    "2026 MSA Agency. Engineered & Designed by <a href='../profiles/amr.html' class='founder-sig'>Amr Eladly</a>";
  res.json({ signature });
});

const adminRouter = express.Router();
adminRouter.use(authMiddleware);
const allowedUserRoles = [
  'Founder',
  'Strategist',
  'Creative',
  'Analyst',
  'News',
  'Growth_Manager',
  'Operations',
];

function mapPlanWithPricing(planDoc) {
  const plan = typeof planDoc.toObject === 'function' ? planDoc.toObject() : planDoc;
  const originalPrice = Number(plan.price || 0);
  const discountPercent = Number(plan.discountPercent || 0);

  if (discountPercent > 0) {
    const discountedPrice = Number((originalPrice * (1 - discountPercent / 100)).toFixed(2));
    return {
      ...plan,
      originalPrice,
      discountedPrice,
      hasDiscount: true,
    };
  }

  return {
    ...plan,
    originalPrice,
    discountedPrice: originalPrice,
    hasDiscount: false,
  };
}

adminRouter.get('/users', checkRole(['Founder']), async (_req, res) => {
  const users = await User.find({}, { password: 0 }).sort({ createdAt: -1 });
  res.json(users);
});

adminRouter.post('/users', checkRole(['Founder']), async (req, res) => {
  try {
    const { name, email, password, role } = req.body || {};
    const normalizedEmail = String(email || '')
      .toLowerCase()
      .trim();

    if (!name || !normalizedEmail || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }

    if (!allowedUserRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role provided' });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);
    const created = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role,
    });

    const safeUser = {
      _id: created._id,
      name: created.name,
      email: created.email,
      role: created.role,
      permissions: created.permissions,
      profilePath: created.profilePath,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };

    return res.status(201).json(safeUser);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create user', details: error.message });
  }
});

adminRouter.put('/users/:id/password', checkRole(['Founder']), async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body || {};

    if (!password || String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);
    const updated = await User.findByIdAndUpdate(
      id,
      {
        $set: {
          password: hashedPassword,
        },
      },
      {
        new: true,
      }
    );

    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ ok: true, id: updated._id });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to change password', details: error.message });
  }
});

adminRouter.get('/plans', checkRole(['Founder', 'Growth_Manager']), async (_req, res) => {
  const plans = await Plan.find({}).sort({ createdAt: -1 });
  res.json(plans.map(mapPlanWithPricing));
});

adminRouter.post('/plans', checkRole(['Founder', 'Growth_Manager']), async (req, res) => {
  try {
    const {
      planId,
      category,
      title_en,
      title_ar,
      price,
      discountPercent,
      features_en,
      features_ar,
      isSpecialOffer,
    } = req.body || {};

    if (!planId || !category || !title_en || !title_ar || typeof price !== 'number') {
      return res
        .status(400)
        .json({ error: 'planId, category, title_en, title_ar and numeric price are required' });
    }

    const created = await Plan.create({
      planId: String(planId).trim(),
      category: String(category).trim(),
      title_en: String(title_en).trim(),
      title_ar: String(title_ar).trim(),
      price,
      discountPercent: Number(discountPercent || 0),
      features_en: Array.isArray(features_en)
        ? features_en.map((f) => String(f).trim()).filter(Boolean)
        : [],
      features_ar: Array.isArray(features_ar)
        ? features_ar.map((f) => String(f).trim()).filter(Boolean)
        : [],
      isSpecialOffer: Boolean(isSpecialOffer),
    });

    return res.status(201).json(mapPlanWithPricing(created));
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create plan', details: error.message });
  }
});

adminRouter.put('/plans/:id', checkRole(['Founder', 'Growth_Manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      planId,
      category,
      title_en,
      title_ar,
      price,
      discountPercent,
      features_en,
      features_ar,
      isSpecialOffer,
    } = req.body || {};

    const update = {
      ...(typeof planId === 'string' ? { planId: planId.trim() } : {}),
      ...(typeof category === 'string' ? { category: category.trim() } : {}),
      ...(typeof title_en === 'string' ? { title_en: title_en.trim() } : {}),
      ...(typeof title_ar === 'string' ? { title_ar: title_ar.trim() } : {}),
      ...(typeof price === 'number' ? { price } : {}),
      ...(typeof discountPercent === 'number' ? { discountPercent } : {}),
      ...(Array.isArray(features_en)
        ? { features_en: features_en.map((f) => String(f).trim()).filter(Boolean) }
        : {}),
      ...(Array.isArray(features_ar)
        ? { features_ar: features_ar.map((f) => String(f).trim()).filter(Boolean) }
        : {}),
      ...(typeof isSpecialOffer === 'boolean' ? { isSpecialOffer } : {}),
    };

    const updated = await Plan.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!updated) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    return res.json(mapPlanWithPricing(updated));
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update plan', details: error.message });
  }
});

adminRouter.delete('/plans/:id', checkRole(['Founder', 'Growth_Manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Plan.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete plan', details: error.message });
  }
});

adminRouter.get('/success', checkRole(['Founder', 'News', 'Strategist', 'Operations']), async (_req, res) => {
  const items = await Success.find({}).sort({ createdAt: -1 });
  res.json(items);
});

adminRouter.post('/success', checkRole(['Founder', 'News', 'Strategist', 'Operations']), async (req, res) => {
  try {
    const { title, content, technicalDetails, lang, category, published } = req.body || {};
    if (!title || !content) {
      return res.status(400).json({ error: 'title and content are required' });
    }

    const created = await Success.create({
      title: String(title).trim(),
      content: String(content).trim(),
      technicalDetails: typeof technicalDetails === 'string' ? technicalDetails.trim() : '',
      lang: lang === 'ar' ? 'ar' : 'en',
      category: ['News', 'Model_A', 'Model_B', 'Model_C'].includes(category) ? category : 'News',
      published: published !== false,
    });
    return res.status(201).json(created);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create success item', details: error.message });
  }
});

adminRouter.put('/success/:id', checkRole(['Founder', 'News', 'Strategist', 'Operations']), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, technicalDetails, lang, category, published } = req.body || {};

    const update = {
      ...(title ? { title: String(title).trim() } : {}),
      ...(content ? { content: String(content).trim() } : {}),
      ...(typeof technicalDetails === 'string' ? { technicalDetails: technicalDetails.trim() } : {}),
      ...(lang ? { lang: lang === 'ar' ? 'ar' : 'en' } : {}),
      ...(category && ['News', 'Model_A', 'Model_B', 'Model_C'].includes(category)
        ? { category }
        : {}),
      ...(typeof published === 'boolean' ? { published } : {}),
    };

    const updated = await Success.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!updated) {
      return res.status(404).json({ error: 'Success item not found' });
    }
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update success item', details: error.message });
  }
});

adminRouter.delete('/success/:id', checkRole(['Founder', 'News', 'Strategist', 'Operations']), async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Success.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Success item not found' });
    }
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete success item', details: error.message });
  }
});

adminRouter.get('/partners', checkRole(['Founder', 'Strategist', 'News', 'Operations']), async (_req, res) => {
  const items = await Partner.find({}).sort({ createdAt: -1 });
  res.json(items);
});

adminRouter.post('/partners', checkRole(['Founder', 'Strategist', 'News', 'Operations']), async (req, res) => {
  try {
    const { name, logoUrl, websiteUrl } = req.body || {};
    if (!name || !logoUrl) {
      return res.status(400).json({ error: 'name and logoUrl are required' });
    }

    const created = await Partner.create({
      name: String(name).trim(),
      logoUrl: String(logoUrl).trim(),
      websiteUrl: typeof websiteUrl === 'string' ? websiteUrl.trim() : '',
    });

    return res.status(201).json(created);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create partner', details: error.message });
  }
});

adminRouter.put('/partners/:id', checkRole(['Founder', 'Strategist', 'News', 'Operations']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, logoUrl, websiteUrl } = req.body || {};

    const update = {
      ...(name ? { name: String(name).trim() } : {}),
      ...(logoUrl ? { logoUrl: String(logoUrl).trim() } : {}),
      ...(typeof websiteUrl === 'string' ? { websiteUrl: websiteUrl.trim() } : {}),
    };

    const updated = await Partner.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!updated) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update partner', details: error.message });
  }
});

adminRouter.delete('/partners/:id', checkRole(['Founder', 'Strategist', 'News', 'Operations']), async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Partner.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete partner', details: error.message });
  }
});

adminRouter.get('/settings', checkRole(['Founder']), async (_req, res) => {
  const settings = await Settings.findOne().sort({ createdAt: -1 });
  res.json(settings || null);
});

adminRouter.put('/settings', checkRole(['Founder']), async (req, res) => {
  try {
    const { footer_sig_en, footer_sig_ar, founder_title, globalAlert } = req.body || {};
    const updated = await Settings.findOneAndUpdate(
      {},
      {
        $set: {
          ...(footer_sig_en
            ? {
                footer_sig_en: String(footer_sig_en).trim(),
                footerSignature: String(footer_sig_en).trim(),
              }
            : {}),
          ...(footer_sig_ar ? { footer_sig_ar: String(footer_sig_ar).trim() } : {}),
          ...(typeof founder_title === 'string' ? { founder_title: founder_title.trim() } : {}),
          ...(typeof globalAlert === 'string' ? { globalAlert: globalAlert.trim() } : {}),
        },
      },
      {
        new: true,
        upsert: true,
      }
    );

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update settings', details: error.message });
  }
});

app.use('/api/admin', adminRouter);

app.get('/api/partners/public', async (_req, res) => {
  const partners = await Partner.find({}, { name: 1, logoUrl: 1, websiteUrl: 1 }).sort({ createdAt: -1 });
  res.json(partners);
});

app.get('/api/plans/public', async (_req, res) => {
  const plans = await Plan.find({}).sort({ createdAt: -1 });
  res.json(plans.map(mapPlanWithPricing));
});

app.use('/assets', express.static(path.join(webRoot, 'assets')));
app.use('/profiles', express.static(path.join(webRoot, 'profiles')));
app.use('/services', express.static(path.join(webRoot, 'services')));
app.use('/admin', express.static(path.join(webRoot, 'public_html', 'admin')));
app.use(express.static(webRoot));

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'MSA Agency API is running...',
    version: '1.0.0',
  });
});

app.get('/admin', (_req, res) => {
  res.status(200).send('Admin Dashboard API Access');
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  return res.status(404).send('Resource not found');
});

async function start() {
  try {
    await connectDB();
    const server = app.listen(PORT, '0.0.0.0', () => {
      // eslint-disable-next-line no-console
      console.log(`MSA server running on port ${PORT}`);
    });

    server.on('error', (error) => {
      if (error && error.code === 'EADDRINUSE') {
        // eslint-disable-next-line no-console
        console.error(`Port ${PORT} is already in use. Stop the existing process or set a different PORT.`);
      } else {
        // eslint-disable-next-line no-console
        console.error('Server listen error:', error);
      }
      process.exit(1);
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Server startup failed:', error);
    process.exit(1);
  }
}

start();