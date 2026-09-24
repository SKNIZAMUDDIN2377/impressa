const Note = require("../models/Note");

// ==========================================
// CREATE NOTE
// ==========================================

const createNote = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: "Note cannot be empty",
      });
    }

    const note = await Note.create({
      user: req.user.userId,
      text: text.trim(),
    });

    const populatedNote = await Note.findById(note._id).populate(
      "user",
      "name username profilePicture badge isOfficial"
    );

    res.status(201).json({
      success: true,
      message: "Note created successfully",
      note: populatedNote,
    });
  } catch (error) {
    console.error("Create note error ❌", error);

    res.status(500).json({
      success: false,
      message: "Server error while creating note",
    });
  }
};

// ==========================================
// GET MY NOTES
// ==========================================

const getMyNotes = async (req, res) => {
  try {
    const notes = await Note.find({
      user: req.user.userId,
    })
      .populate(
        "user",
        "name username profilePicture badge isOfficial"
      )
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      notes,
    });
  } catch (error) {
    console.error("Get my notes error ❌", error);

    res.status(500).json({
      success: false,
      message: "Server error while fetching notes",
    });
  }
};

// ==========================================
// GET USER NOTES
// ==========================================

const getUserNotes = async (req, res) => {
  try {
    const { username } = req.params;

    const User = require("../models/User");

    const user = await User.findOne({
      username: username.toLowerCase(),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const notes = await Note.find({
      user: user._id,
    })
      .populate(
        "user",
        "name username profilePicture badge isOfficial"
      )
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      notes,
    });
  } catch (error) {
    console.error("Get user notes error ❌", error);

    res.status(500).json({
      success: false,
      message: "Server error while fetching user notes",
    });
  }
};

// ==========================================
// DELETE NOTE
// ==========================================

const deleteNote = async (req, res) => {
  try {
    const { noteId } = req.params;

    const note = await Note.findOneAndDelete({
      _id: noteId,
      user: req.user.userId,
    });

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Note deleted successfully",
    });
  } catch (error) {
    console.error("Delete note error ❌", error);

    res.status(500).json({
      success: false,
      message: "Server error while deleting note",
    });
  }
};

module.exports = {
  createNote,
  getMyNotes,
  getUserNotes,
  deleteNote,
};