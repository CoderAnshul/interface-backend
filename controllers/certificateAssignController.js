import CertificateAssignService from '../service/certificateAssignService.js';
import fs from 'fs';
import path from 'path';

const certificateAssignService = new CertificateAssignService();

export const assignCertificate = async (req, res) => {
  try {
    //console.log('Request Body:', JSON.stringify(req.body, null, 2)); // Debug log
    //console.log('Request Headers:', JSON.stringify(req.headers, null, 2)); // Log headers
    const userId = req.user._id;
    const assignment = await certificateAssignService.assignCertificate(req.body, userId);
    return res.status(201).json({
      success: true,
      message: 'Certificate assigned successfully',
      data: assignment,
    });
  } catch (error) {
    console.error('Assign Certificate Error:', error);
    return res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: 'Failed to assign certificate',
      error: error.message,
    });
  }
};

export const getCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const assignment = await certificateAssignService.getCertificate(id);
    return res.status(200).json({
      success: true,
      data: assignment,
    });
  } catch (error) {
    console.error('Get Certificate Error:', error);
    return res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: 'Failed to retrieve certificate',
      error: error.message,
    });
  }
};

export const getAllCertificates = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const { templates, totalCount } = await certificateAssignService.getAllCertificates(parseInt(page), parseInt(limit));
    return res.status(200).json({
      success: true,
      data: {
        templates,
        totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error('Get All Certificates Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve certificates',
      error: error.message,
    });
  }
};

export const updateCertificate = async (req, res) => {
  try {
    //console.log('Update Certificate Request Body:', JSON.stringify(req.body, null, 2)); // Debug log
    //console.log('Request Headers:', JSON.stringify(req.headers, null, 2)); // Log headers
    const { id } = req.params;
    const userId = req.user._id;
    const assignment = await certificateAssignService.updateCertificate(id, req.body, userId);
    return res.status(200).json({
      success: true,
      message: 'Certificate updated successfully',
      data: assignment,
    });
  } catch (error) {
    console.error('Update Certificate Error:', error);
    return res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: 'Failed to update certificate',
      error: error.message,
    });
  }
};

export const deleteCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    await certificateAssignService.deleteCertificate(id);
    return res.status(200).json({
      success: true,
      message: 'Certificate deleted successfully',
    });
  } catch (error) {
    console.error('Delete Certificate Error:', error);
    return res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: 'Failed to delete certificate',
      error: error.message,
    });
  }
};

export const downloadCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const filePath = await certificateAssignService.downloadCertificate(id);
    const fileName = path.basename(filePath);

    // Set headers for file download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on('error', (err) => {
      console.error('File Stream Error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to stream certificate PDF',
        error: err.message,
      });
    });
  } catch (error) {
    console.error('Download Certificate Error:', error);
    return res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: 'Failed to download certificate',
      error: error.message,
    });
  }
};