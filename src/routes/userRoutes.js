const express = require('express'); 
const router = express.Router();
const userController = require('../controllers/userController');

router.post('/register', userController.createUser);  // Use the correct function name
router.get('/:client_id', userController.getUserById);  // Fetch user details by ID
router.get('/',userController.getAllUsers);//Fetch all users
router.put('/:client_id',userController.updateUser);
module.exports = router;

