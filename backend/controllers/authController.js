const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'supersecretjwtkey', { expiresIn: '30d' });
};

exports.register = async (req, res) => {
  const { name, email, password, role, imageBase64 } = req.body;
  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let faceEncoding = [];
    if (imageBase64) {
      const aiResponse = await axios.post(`${FASTAPI_URL}/api/face/encode`, { image: imageBase64 });
      faceEncoding = aiResponse.data.encoding;
    }

    const user = await User.create({
      name, email, password: hashedPassword, role, faceEncoding
    });

    res.status(201).json({
      _id: user.id, name: user.name, email: user.email, role: user.role, token: generateToken(user.id)
    });
  } catch (error) {
    console.error('Registration Error:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

exports.loginWithFace = async (req, res) => {
  const { imageBase64, role } = req.body;
  try {
    const filter = { faceEncoding: { $exists: true, $not: { $size: 0 } } };
    if (role) {
      filter.role = role;
    }
    const users = await User.find(filter);
    if (users.length === 0) return res.status(400).json({ message: `No users registered as ${role || 'buyer/seller'} with face encodings found` });

    const encodings = users.map(u => u.faceEncoding);
    
    const aiResponse = await axios.post(`${FASTAPI_URL}/api/face/verify`, {
      image: imageBase64,
      known_encodings: encodings
    });

    const matchIndex = aiResponse.data.match_index;
    if (matchIndex === -1) return res.status(401).json({ message: 'Face not recognized' });

    const matchedUser = users[matchIndex];
    res.json({
      _id: matchedUser.id, name: matchedUser.name, email: matchedUser.email, role: matchedUser.role, token: generateToken(matchedUser.id)
    });
  } catch (error) {
    console.error('Face Login Error:', error.response?.data || error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

exports.login = async (req, res) => {
  const { email, password, role } = req.body;
  try {
    const user = await User.findOne({ email });
    if (user && (await bcrypt.compare(password, user.password))) {
      if (role && user.role !== role) {
        return res.status(401).json({ message: `Access denied: User is not registered as a ${role}` });
      }
      res.json({
        _id: user.id, name: user.name, email: user.email, role: user.role, token: generateToken(user.id)
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};
