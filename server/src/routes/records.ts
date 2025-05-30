import { Router, Request, Response, RequestHandler } from 'express';
import { Database } from '../db/database';
import { Location, LocationQuery, ApiResponse } from '../types';

const router = Router();
const db = new Database();

/**
 * POST /api/records
 * Create new location record
 */
const createRecord: RequestHandler = async (req: Request, res: Response) => {
  try {
    const locationData: Location = req.body;

    // Validation
    if (!locationData.address?.addressAndName) {
      res.status(400).json({
        success: false,
        error: 'Address is required'
      } as ApiResponse);
      return;
    }

    if (!locationData.floors || !Array.isArray(locationData.floors)) {
      res.status(400).json({
        success: false,
        error: 'Floors data is required'
      } as ApiResponse);
      return;
    }

    // Set timestamp if not provided
    if (!locationData.timestamp) {
      locationData.timestamp = Date.now();
    }

    const savedLocation = await db.createLocation(locationData);

    res.status(201).json({
      success: true,
      data: savedLocation,
      message: 'Location record created successfully'
    } as ApiResponse<Location>);

  } catch (error) {
    console.error('Error creating location record:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create location record'
    } as ApiResponse);
  }
};

/**
 * GET /api/records
 * Get location records with optional filtering
 */
const getRecords: RequestHandler = async (req: Request, res: Response) => {
  try {
    const query: LocationQuery = {
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      locationType: req.query.locationType as string,
      search: req.query.search as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    };

    const locations = await db.getLocations(query);

    res.json({
      success: true,
      data: locations,
      message: `Retrieved ${locations.length} location records`
    } as ApiResponse<Location[]>);

  } catch (error) {
    console.error('Error fetching location records:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch location records'
    } as ApiResponse);
  }
};

/**
 * GET /api/records/:id
 * Get specific location record by ID
 */
const getRecordById: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Location ID is required'
      } as ApiResponse);
      return;
    }

    const location = await db.getLocationById(id);

    if (!location) {
      res.status(404).json({
        success: false,
        error: 'Location not found'
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: location,
      message: 'Location record retrieved successfully'
    } as ApiResponse<Location>);

  } catch (error) {
    console.error('Error fetching location record:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch location record'
    } as ApiResponse);
  }
};

/**
 * PUT /api/records/:id
 * Update location record
 */
const updateRecord: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData: Partial<Location> = req.body;

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Location ID is required'
      } as ApiResponse);
      return;
    }

    const updatedLocation = await db.updateLocation(id, updateData);

    if (!updatedLocation) {
      res.status(404).json({
        success: false,
        error: 'Location not found'
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: updatedLocation,
      message: 'Location record updated successfully'
    } as ApiResponse<Location>);

  } catch (error) {
    console.error('Error updating location record:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update location record'
    } as ApiResponse);
  }
};

/**
 * DELETE /api/records/:id
 * Delete location record
 */
const deleteRecord: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Location ID is required'
      } as ApiResponse);
      return;
    }

    const deleted = await db.deleteLocation(id);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'Location not found'
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      message: 'Location record deleted successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Error deleting location record:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete location record'
    } as ApiResponse);
  }
};

/**
 * GET /api/records/stats
 * Get statistics about location records
 */
const getStats: RequestHandler = async (req: Request, res: Response) => {
  try {
    const allLocations = await db.getLocations();
    
    const stats = {
      total: allLocations.length,
      byType: allLocations.reduce((acc, loc) => {
        const type = loc.locationType || 'unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      recentCount: allLocations.filter(loc => 
        Date.now() - loc.timestamp < 7 * 24 * 60 * 60 * 1000 // Last 7 days
      ).length,
      totalPhotos: allLocations.reduce((acc, loc) => 
        acc + loc.floors.reduce((floorAcc, floor) => 
          floorAcc + floor.photos.length, 0), 0
      )
    };

    res.json({
      success: true,
      data: stats,
      message: 'Statistics retrieved successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    } as ApiResponse);
  }
};

// Register routes
router.post('/', createRecord);
router.get('/', getRecords);
router.get('/stats', getStats); // Register before /:id to avoid conflicts
router.get('/:id', getRecordById);
router.put('/:id', updateRecord);
router.delete('/:id', deleteRecord);

export default router; 