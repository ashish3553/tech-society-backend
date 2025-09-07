const Character = require('../models/Character');

exports.createCharacter = async (req, res, next) => {
  try {
    const character = new Character({
      ...req.body,
      createdBy: req.user.id
    });

    await character.save();

    res.status(201).json({
      success: true,
      data: character
    });
  } catch (error) {
    next(error);
  }
};

exports.getMyCharacters = async (req, res, next) => {
  try {
    // NEW: All characters available to all mentors/admins
    const characters = await Character.find({})
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: characters
    });
  } catch (error) {
    next(error);
  }
};

exports.updateCharacter = async (req, res, next) => {
  try {
    const character = await Character.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user.id },
      req.body,
      { new: true }
    );

    if (!character) {
      return res.status(404).json({
        success: false,
        message: 'Character not found'
      });
    }

    res.json({
      success: true,
      data: character
    });
  } catch (error) {
    next(error);
  }
};