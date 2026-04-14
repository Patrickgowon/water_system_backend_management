const Driver = require('../models/Driver');
const WaterRequest = require('../models/WaterRequest');

// ─── Report an incident (Driver) ─────────────────────────────────────────
exports.reportIncident = async (req, res) => {
  try {
    const driverId = req.user.id;
    const { type, description, orderId } = req.body;

    // Validate required fields
    if (!type || !description) {
      return res.status(400).json({
        success: false,
        message: 'Incident type and description are required'
      });
    }

    // Validate incident type
    const validTypes = ['breakdown', 'accident', 'flat', 'fuel', 'delay', 'other'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid incident type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    // Find driver
    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    // Create incident object
    const incident = {
      type,
      description,
      reportedAt: new Date(),
      status: 'pending',
      orderId: orderId || null
    };

    // Add incident to driver's incidents array
    driver.incidents.push(incident);
    driver.incidentsCount = (driver.incidentsCount || 0) + 1;
    await driver.save();

    // Also add a notification for the driver
    driver.addNotification('alert', 'Incident Reported', `Your ${type} incident has been reported to dispatch.`);

    // If there's an associated order, update its status
    if (orderId) {
      const order = await WaterRequest.findById(orderId);
      if (order && order.status !== 'completed') {
        order.status = 'delayed';
        order.incidentReported = true;
        await order.save();
      }
    }

    res.status(201).json({
      success: true,
      message: 'Incident reported successfully. Dispatch has been notified.',
      data: {
        incidentId: driver.incidents[driver.incidents.length - 1]._id,
        type,
        description,
        reportedAt: incident.reportedAt,
        status: 'pending'
      }
    });

  } catch (err) {
    console.error('❌ Report incident error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ─── Get all incidents for a driver ──────────────────────────────────────
exports.getMyIncidents = async (req, res) => {
  try {
    const driverId = req.user.id;

    const driver = await Driver.findById(driverId).select('incidents incidentsCount');
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    // Sort incidents by reportedAt descending (newest first)
    const incidents = (driver.incidents || []).sort((a, b) => 
      new Date(b.reportedAt) - new Date(a.reportedAt)
    );

    res.status(200).json({
      success: true,
      data: {
        incidents,
        totalCount: driver.incidentsCount || 0,
        pendingCount: incidents.filter(i => i.status === 'pending').length,
        resolvedCount: incidents.filter(i => i.status === 'resolved').length
      }
    });

  } catch (err) {
    console.error('❌ Get incidents error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ─── Get single incident by ID ───────────────────────────────────────────
exports.getIncidentById = async (req, res) => {
  try {
    const driverId = req.user.id;
    const { incidentId } = req.params;

    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const incident = driver.incidents.id(incidentId);
    if (!incident) {
      return res.status(404).json({
        success: false,
        message: 'Incident not found'
      });
    }

    res.status(200).json({
      success: true,
      data: incident
    });

  } catch (err) {
    console.error('❌ Get incident by ID error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ─── Resolve an incident (Admin only) ────────────────────────────────────
exports.resolveIncident = async (req, res) => {
  try {
    const { driverId, incidentId } = req.params;
    const { resolvedNote } = req.body;

    // Check if user is admin (you'll add admin check middleware)
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can resolve incidents'
      });
    }

    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const incident = driver.incidents.id(incidentId);
    if (!incident) {
      return res.status(404).json({
        success: false,
        message: 'Incident not found'
      });
    }

    incident.status = 'resolved';
    incident.resolvedAt = new Date();
    incident.resolvedNote = resolvedNote || 'Resolved by admin';
    await driver.save();

    // Add notification to driver that incident is resolved
    driver.addNotification('success', 'Incident Resolved', `Your ${incident.type} incident has been resolved.`);

    res.status(200).json({
      success: true,
      message: 'Incident resolved successfully',
      data: incident
    });

  } catch (err) {
    console.error('❌ Resolve incident error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ─── Get all incidents (Admin only) ──────────────────────────────────────
exports.getAllIncidents = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can view all incidents'
      });
    }

    const { status, type, fromDate, toDate } = req.query;

    // Build query to find drivers with incidents
    let query = {};
    
    if (status) {
      query['incidents.status'] = status;
    }
    if (type) {
      query['incidents.type'] = type;
    }

    const drivers = await Driver.find(query).select('firstName lastName tankerId incidents incidentsCount');
    
    // Collect all incidents with driver info
    let allIncidents = [];
    drivers.forEach(driver => {
      driver.incidents.forEach(incident => {
        // Apply date filters if provided
        let include = true;
        if (fromDate && new Date(incident.reportedAt) < new Date(fromDate)) include = false;
        if (toDate && new Date(incident.reportedAt) > new Date(toDate)) include = false;
        
        if (include) {
          allIncidents.push({
            _id: incident._id,
            driverId: driver._id,
            driverName: `${driver.firstName} ${driver.lastName}`,
            tankerId: driver.tankerId,
            type: incident.type,
            description: incident.description,
            reportedAt: incident.reportedAt,
            status: incident.status,
            resolvedAt: incident.resolvedAt,
            resolvedNote: incident.resolvedNote
          });
        }
      });
    });

    // Sort by reportedAt descending
    allIncidents.sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt));

    res.status(200).json({
      success: true,
      data: allIncidents,
      total: allIncidents.length
    });

  } catch (err) {
    console.error('❌ Get all incidents error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};