const User = require('../models/User');
const Professional = require('../models/Professional');
const notificationService = require('./notificationService');
const smsService = require('./smsService');
const analyticsService = require('./analyticsService');
const HelpRequest = require('../models/HelpRequest');

const MAX_DISTANCE = 5000; // 5km default

/**
 * Core hyperlocal matching algorithm.
 *
 * Two-path routing (from user flow diagram):
 *  - community path: Find nearby helpers, score by proximity/rating/speed, notify top 5
 *  - professional path: Find verified professionals, notify all matches for quote submission
 */
exports.findAndNotifyMatches = async (helpRequest) => {
  try {
    const { coordinates } = helpRequest.location;
    if (!coordinates || coordinates.length !== 2) return [];

    const pathType = helpRequest.pathType || 'community';

    if (pathType === 'community') {
      return await _matchCommunityPath(helpRequest, coordinates);
    } else {
      return await _matchProfessionalPath(helpRequest, coordinates);
    }
  } catch (error) {
    console.error('[Matching] Fatal error:', error);
    return [];
  }
};

// ─── Community Path ────────────────────────────────────────────────────────────
// Simple, urgent, peer-to-peer: score helpers, notify top 5 (first responder wins)

async function _matchCommunityPath(helpRequest, coordinates) {
  const matchQuery = {
    _id: { $ne: helpRequest.userId },
    role: { $in: ['helper', 'user'] },
    isAvailable: true,
    isActive: true
  };

  if (helpRequest.requiredSkills && helpRequest.requiredSkills.length > 0) {
    matchQuery.skills = { $in: helpRequest.requiredSkills };
  }

  const helpersWithDistance = await User.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates },
        distanceField: 'calculatedDistance',
        maxDistance: MAX_DISTANCE,
        query: matchQuery,
        spherical: true
      }
    },
    { $limit: 50 }
  ]);

  if (helpersWithDistance.length === 0) {
    console.log(`[Matching][Community] No helpers within ${MAX_DISTANCE / 1000}km for request ${helpRequest._id}`);
    return [];
  }

  // Score each helper
  const scoredHelpers = helpersWithDistance.map(helper => {
    const normalizedDistance = Math.min(helper.calculatedDistance / MAX_DISTANCE, 1);
    const normalizedRating = (helper.averageRating || 0) / 5.0;
    const avgTime = helper.responseHistory?.averageResponseTime || 30;
    const normalizedResponseSpeed = Math.max(0, (60 - avgTime) / 60);
    const skillBonus = (helpRequest.requiredSkills?.length > 0 && helper.skills?.length > 0)
      ? (helpRequest.requiredSkills.filter(s => helper.skills.includes(s)).length / helpRequest.requiredSkills.length) * 0.1
      : 0;

    const score =
      (1 - normalizedDistance) * 0.5 +
      normalizedRating * 0.3 +
      normalizedResponseSpeed * 0.2 +
      skillBonus;

    return { helper, score };
  });

  scoredHelpers.sort((a, b) => b.score - a.score);
  const top10 = scoredHelpers.slice(0, 10).map(i => i.helper);
  const top5 = top10.slice(0, 5);

  console.log(`[Matching][Community] Notifying top ${top5.length} helpers for request ${helpRequest._id}`);

  const notifiedIds = [];
  await Promise.allSettled(
    top5.map(async (helper) => {
      try {
        await notificationService.sendNotification({
          userId: helper._id,
          type: 'NEW_REQUEST',
          title: '🆕 New Help Request Nearby!',
          message: `Someone near you needs help: "${helpRequest.title}". Tap to view details.`,
          data: {
            requestId: helpRequest._id.toString(),
            category: helpRequest.category,
            urgency: helpRequest.urgency,
            pathType: 'community',
            distance: Math.round(helper.calculatedDistance)
          }
        });

        // Also send SMS if helper has phone
        if (helper.phone) {
          await smsService.notifyHelperSMS(helper.phone, helpRequest.title, 'Someone nearby');
        }

        notifiedIds.push(helper._id);
      } catch (err) {
        console.error(`[Matching] Failed to notify helper ${helper._id}:`, err.message);
      }
    })
  );

  if (notifiedIds.length > 0) {
    await HelpRequest.findByIdAndUpdate(helpRequest._id, {
      $addToSet: { notifiedHelperIds: { $each: notifiedIds } }
    });
  }

  analyticsService.trackHelperMatched(helpRequest._id.toString(), notifiedIds.length);

  return top10;
}

// ─── Professional Path ─────────────────────────────────────────────────────────
// Skilled work, paid service: notify all matching verified professionals for quotes

async function _matchProfessionalPath(helpRequest, coordinates) {
  const matchQuery = {
    _id: { $ne: helpRequest.userId },
    role: 'professional',
    isActive: true,
    isVerified: true
  };

  if (helpRequest.requiredSkills && helpRequest.requiredSkills.length > 0) {
    matchQuery.skills = { $in: helpRequest.requiredSkills };
  }

  const professionalsWithDistance = await User.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates },
        distanceField: 'calculatedDistance',
        maxDistance: 15000, // Wider radius for professionals (15km)
        query: matchQuery,
        spherical: true
      }
    },
    { $sort: { averageRating: -1 } },
    { $limit: 20 } // Notify up to 20 professionals for quotes
  ]);

  if (professionalsWithDistance.length === 0) {
    console.log(`[Matching][Professional] No professionals found for request ${helpRequest._id}`);
    return [];
  }

  console.log(`[Matching][Professional] Notifying ${professionalsWithDistance.length} professionals for quotes`);

  const notifiedIds = [];
  await Promise.allSettled(
    professionalsWithDistance.map(async (pro) => {
      try {
        await notificationService.sendNotification({
          userId: pro._id,
          type: 'NEW_REQUEST',
          title: '💼 New Job Request — Submit Your Quote',
          message: `New ${helpRequest.category} job near you: "${helpRequest.title}". Submit your best quote!`,
          data: {
            requestId: helpRequest._id.toString(),
            category: helpRequest.category,
            pathType: 'professional',
            distance: Math.round(pro.calculatedDistance)
          }
        });

        if (pro.phone) {
          await smsService.notifyHelperSMS(pro.phone, helpRequest.title, 'a client');
        }

        notifiedIds.push(pro._id);
      } catch (err) {
        console.error(`[Matching] Failed to notify professional ${pro._id}:`, err.message);
      }
    })
  );

  if (notifiedIds.length > 0) {
    await HelpRequest.findByIdAndUpdate(helpRequest._id, {
      $addToSet: { notifiedHelperIds: { $each: notifiedIds } }
    });
  }

  analyticsService.trackHelperMatched(helpRequest._id.toString(), notifiedIds.length);

  return professionalsWithDistance;
}
