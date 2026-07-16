export const isAdmin = (req, res, next) => {
  // Allow admin, instructor, student, and partner roles to access admin panel
  // NOTE: This is a temporary development setting - restrict to admin/instructor in production
  if (req.user && (req.user.role === 'admin' || req.user.role === 'instructor' || req.user.role === 'student' || req.user.role === 'partner')) {
    return next();
  }

  // Log for debugging
  console.log('Access denied - User:', req.user ? {
    id: req.user._id || req.user.id,
    role: req.user.role,
    email: req.user.email
  } : 'No user found');

  return res.status(403).json({
    success: false,
    message: 'Access denied: Admin, Instructor, Student, or Partner role required',
    data: {},
    err: {
      message: 'Unauthorized access',
      userRole: req.user?.role || 'not authenticated'
    },
  });
};