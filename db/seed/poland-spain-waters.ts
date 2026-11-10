import type { WaterBodyRecord } from '@/shared/types/domain';

export const SEEDED_WATER_BODIES: WaterBodyRecord[] = [
  {
    id: 'wb-es-cortes-valencia',
    osmId: 'relation/3491821',
    name: 'Embalse de Cortes (Cofrentes — Valencia)',
    regionLabel: 'Valencia, Spain',
    waterType: 'freshwater',
    countryCode: 'ES',
    centerLat: 39.242,
    centerLng: -0.946,
    avgRating: 4.9,
    reviewCount: 24,
    commonSpecies: ['black_bass', 'carp', 'zander', 'barbel', 'pike'],
    description:
      'Spectacular canyon reservoir on the Júcar River southwest of Valencia (between Cofrentes and Cortes de Pallás). Deep turquoise channel walls, flooded pine points (Dehesa de Cortes), and accessible coves like Playa del Ral and Carpa Cofrentes.',
    bbox: [-0.972, 39.222, -0.920, 39.262],
    polygon: {
      type: 'Feature',
      properties: { name: 'Embalse de Cortes', natural: 'water' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-0.968, 39.225],
            [-0.922, 39.225],
            [-0.922, 39.260],
            [-0.968, 39.260],
            [-0.968, 39.225],
          ],
        ],
      },
    },
    restrictionZones: [
      {
        id: 'rz-es-cortes-dam',
        cellId: 'H1',
        status: 'prohibited',
        reason:
          'Presa de Cortes de Pallás Hydroelectric Intake & Dam Wall — 100m strict safety exclusion zone.',
        source: 'osm',
      },
      {
        id: 'rz-es-cortes-licencia',
        status: 'permit_required',
        reason:
          'Requires Comunidad Valenciana Licencia de Pesca Recreo. Live bait prohibited under invasive species regulations.',
        source: 'official',
      },
    ],
    preSeededSpots: [
      {
        id: 'spot-cortes-1',
        rank: 1,
        cell_id: 'F6',
        coordinates: { latitude: 39.2335, longitude: -0.9415 },
        title: 'Dehesa de Cortes Main Peninsula Point',
        confidence_score: 97,
        spot_category: 'primary_hot',
        feature_tags: ['Submerged Rocky Point', '14m Channel Drop-off', 'Main Current Bend'],
        why_this_spot:
          'Primary structural ambush point where the Dehesa de Cortes peninsula juts into the main Júcar channel, dropping from 3m boulders to 14m deep water.',
        tactical_advice: {
          recommended_baits_or_lures: [
            '11cm suspending jerkbait (ayu/natural shad)',
            '3/8 oz football jig with green-pumpkin craw trailer',
          ],
          presentation_tips:
            'Fan-cast across the submerged rocky nose in F6 and pause 3–4 seconds over the 6m breakline.',
          best_time_of_day: 'First light and late afternoon shadow line',
        },
        target_species_fit: ['black_bass', 'zander', 'pike'],
        restriction_status: 'permit_required',
        avg_rating: 4.9,
        review_count: 10,
      },
      {
        id: 'spot-cortes-2',
        rank: 2,
        cell_id: 'E2',
        coordinates: { latitude: 39.2515, longitude: -0.9455 },
        title: 'Northern Canyon Wall & Submerged Ledge',
        confidence_score: 94,
        spot_category: 'primary_hot',
        feature_tags: ['Steep Limestone Wall', 'Deep Shade Ledge', 'Timber Cover'],
        why_this_spot:
          'Vertical canyon wall offering deep shade and stepped rock ledges that hold trophy black bass and zander year-round.',
        tactical_advice: {
          recommended_baits_or_lures: [
            'Drop-shot rig with 4.5" finesse worm',
            '10cm paddle-tail shad on 14g jig head bounced down the staircase ledge',
          ],
          presentation_tips:
            'Pitch tight to the limestone wall in E2 and let the bait pendulum down the vertical drop.',
          best_time_of_day: 'Mid-morning to dusk',
        },
        target_species_fit: ['black_bass', 'zander'],
        restriction_status: 'permit_required',
        avg_rating: 4.8,
        review_count: 6,
      },
      {
        id: 'spot-cortes-3',
        rank: 3,
        cell_id: 'C7',
        coordinates: { latitude: 39.2305, longitude: -0.9585 },
        title: 'Carpa Cofrentes Sheltered Bay & Road Bank',
        confidence_score: 91,
        spot_category: 'shore_cove',
        feature_tags: ['Bank Access', 'Silt-Gravel Flat', 'Carp & Feeder Bay'],
        why_this_spot:
          'Easily accessible shoreline flat near the Carpa Cofrentes access road where warm water and silt-gravel transitions concentrate large common carp and Iberian barbel.',
        tactical_advice: {
          recommended_baits_or_lures: [
            '20mm krill/halibut boilies with PVA pellet bag',
            'Method feeder with sweetcorn and tiger nuts',
          ],
          presentation_tips:
            'Position two rods at 45m and 65m along the gentle slope leading out of the C7 pocket.',
          best_time_of_day: 'Early morning until midday',
        },
        target_species_fit: ['carp', 'barbel'],
        restriction_status: 'permit_required',
        avg_rating: 4.8,
        review_count: 5,
      },
      {
        id: 'spot-cortes-4',
        rank: 4,
        cell_id: 'E1',
        coordinates: { latitude: 39.2572, longitude: -0.9482 },
        title: 'Playa del Ral Shore Shelf & Inflow Mouth',
        confidence_score: 88,
        spot_category: 'shore_cove',
        feature_tags: ['Beach Shore Access', 'Oxygenated Inflow', 'Shallow Feeding Flat'],
        why_this_spot:
          'Gentle gravel entry below the Playa del Ral trailhead where baitfish school in the upper basin.',
        tactical_advice: {
          recommended_baits_or_lures: [
            'Topwater walk-the-dog pencil lure at dawn',
            'Inline spinner or light Carolina rig along the gravel shelf',
          ],
          presentation_tips:
            'Work parallel to the shoreline margin in E1 before hikers arrive.',
          best_time_of_day: 'Dawn to 09:30 AM',
        },
        target_species_fit: ['black_bass', 'barbel', 'carp'],
        restriction_status: 'permit_required',
        avg_rating: 4.6,
        review_count: 3,
      },
      {
        id: 'spot-cortes-5',
        rank: 5,
        cell_id: 'E4',
        coordinates: { latitude: 39.2432, longitude: -0.9472 },
        title: 'Mid-Basin Western Terrace Drop-Off',
        confidence_score: 86,
        spot_category: 'structure_ledge',
        feature_tags: ['Stepped Terrace', '6m–11m Breakline', 'Windblown Bank'],
        why_this_spot:
          'Secondary rocky shelf midway down the western canyon wall where cruising predators corral bleak and roach.',
        tactical_advice: {
          recommended_baits_or_lures: [
            'Deep-diving crankbait (4m–6m runner)',
            'Double-willow spinnerbait in white/chartreuse',
          ],
          presentation_tips:
            'Cast at a 45° angle to the E4 rocky bank and deflect the crankbait off submerged boulders.',
          best_time_of_day: 'Afternoon wind ripple',
        },
        target_species_fit: ['black_bass', 'zander'],
        restriction_status: 'permit_required',
        avg_rating: 4.7,
        review_count: 2,
      },
      {
        id: 'spot-cortes-6',
        rank: 6,
        cell_id: 'E7',
        coordinates: { latitude: 39.2288, longitude: -0.9442 },
        title: 'Southern Arm Junction Ridge',
        confidence_score: 84,
        spot_category: 'structure_ledge',
        feature_tags: ['Underwater Ridge', 'Cove Mouth', 'Submerged Brush'],
        why_this_spot:
          'Submerged ridge at the entrance to the southern cove holding suspended bass and bottom-feeding carp.',
        tactical_advice: {
          recommended_baits_or_lures: [
            'Texas-rigged creature bait in submerged brush',
            '12g blade bait hopped along the ridge spine',
          ],
          presentation_tips:
            'Slowly drag across the E7 crown where the two channels converge.',
          best_time_of_day: 'Late afternoon until sunset',
        },
        target_species_fit: ['black_bass', 'carp', 'zander'],
        restriction_status: 'permit_required',
        avg_rating: 4.5,
        review_count: 2,
      },
    ],
    reviews: [
      {
        id: 'rev-cortes-1',
        waterBodyId: 'wb-es-cortes-valencia',
        spotId: 'spot-cortes-1',
        cellId: 'F6',
        userId: 'user-pablo',
        authorName: 'Pablo S. (Valencia)',
        rating: 5,
        comment:
          'Spot #1 in cell F6 off Dehesa de Cortes is unbelievable! Caught three largemouth bass over 2kg on a suspending jerkbait and a 14kg mirror carp in C7.',
        fishingTypeUsed: 'spinning',
        speciesCaught: [
          { species: 'black_bass', count: 3, lengthCm: 52, weightKg: 2.3 },
          { species: 'carp', count: 1, lengthCm: 84, weightKg: 14.0 },
        ],
        fishedOn: '2026-11-06',
        createdAt: '2026-11-06T18:20:00Z',
        photos: [],
      },
    ],
  },
  {
    id: 'wb-es-tous-valencia',
    osmId: 'relation/3491899',
    name: 'Embalse de Tous (Júcar — Valencia)',
    regionLabel: 'Valencia, Spain',
    waterType: 'freshwater',
    countryCode: 'ES',
    centerLat: 39.155,
    centerLng: -0.665,
    avgRating: 4.8,
    reviewCount: 19,
    commonSpecies: ['black_bass', 'pike', 'zander', 'carp', 'barbel'],
    description:
      'Iconic Valencia reservoir surrounded by drowned river canyons, submerged elongated islands, and dramatic rocky bays. Famous across Spain for giant black bass, predator tournaments, and winter zander jigging.',
    bbox: [-0.695, 39.132, -0.635, 39.178],
    polygon: {
      type: 'Feature',
      properties: { name: 'Embalse de Tous', natural: 'water' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-0.692, 39.135],
            [-0.638, 39.135],
            [-0.638, 39.175],
            [-0.692, 39.175],
            [-0.692, 39.135],
          ],
        ],
      },
    },
    restrictionZones: [
      {
        id: 'rz-es-tous-dam',
        cellId: 'H8',
        status: 'prohibited',
        reason: 'Presa de Tous Spillway & Intake Safety Buffer — fishing prohibited.',
        source: 'osm',
      },
    ],
    preSeededSpots: [
      {
        id: 'spot-tous-1',
        rank: 1,
        cell_id: 'F5',
        coordinates: { latitude: 39.1525, longitude: -0.6545 },
        title: 'Eastern Submerged Island Saddle',
        confidence_score: 96,
        spot_category: 'primary_hot',
        feature_tags: ['Submerged Island', 'Saddle Drop-off', 'Trophy Bass & Pike'],
        why_this_spot:
          'Long submerged island in F5–G5 creating a shallow rocky spine bordered by 12m deep water on both flanks.',
        tactical_advice: {
          recommended_baits_or_lures: [
            '15cm swimbait slow-rolled over the island crest',
            'Carolina-rigged lizard along the southern gravel taper',
          ],
          presentation_tips:
            'Hold the boat or cast from the eastern point across the F5 island saddle.',
          best_time_of_day: 'Sunrise and late afternoon',
        },
        target_species_fit: ['black_bass', 'pike', 'zander'],
        restriction_status: 'permit_required',
        avg_rating: 4.9,
        review_count: 8,
      },
      {
        id: 'spot-tous-2',
        rank: 2,
        cell_id: 'D4',
        coordinates: { latitude: 39.1588, longitude: -0.6695 },
        title: 'Northern Canyon Fork Western Point',
        confidence_score: 93,
        spot_category: 'primary_hot',
        feature_tags: ['Canyon Mouth Point', 'Vertical Rock Wall', 'Baitfish Funnel'],
        why_this_spot:
          'Sharp rocky headland where the northern river canyon opens into the main reservoir basin.',
        tactical_advice: {
          recommended_baits_or_lures: [
            '12cm white/chartreuse soft shad on 16g jig head',
            'Deep crankbait worked down the rocky point',
          ],
          presentation_tips:
            'Hop the jig down the D4 point from 3m to 15m where zander school.',
          best_time_of_day: 'Morning and dusk',
        },
        target_species_fit: ['zander', 'black_bass'],
        restriction_status: 'permit_required',
        avg_rating: 4.8,
        review_count: 5,
      },
      {
        id: 'spot-tous-3',
        rank: 3,
        cell_id: 'E4',
        coordinates: { latitude: 39.1598, longitude: -0.6635 },
        title: 'Mid-Canyon Channel Ledge',
        confidence_score: 89,
        spot_category: 'structure_ledge',
        feature_tags: ['Submerged River Channel', 'Stepped Ledge', 'Suspended Predators'],
        why_this_spot:
          'Opposite canyon wall shelf across from spot #2 where baitballs suspend over the old river bed.',
        tactical_advice: {
          recommended_baits_or_lures: [
            'Jerkbait or finesse ned rig on 5g mushroom head',
          ],
          presentation_tips: 'Twitch along the shade line in E4.',
          best_time_of_day: 'Midday sun when fish seek canyon shade',
        },
        target_species_fit: ['black_bass', 'zander'],
        restriction_status: 'permit_required',
        avg_rating: 4.7,
        review_count: 3,
      },
      {
        id: 'spot-tous-4',
        rank: 4,
        cell_id: 'D7',
        coordinates: { latitude: 39.1398, longitude: -0.6682 },
        title: 'Southern Island Leeward Shoal',
        confidence_score: 87,
        spot_category: 'structure_ledge',
        feature_tags: ['Island Tip', 'Submerged Brush', 'Pike Ambush'],
        why_this_spot:
          'Southern island tapering into a long underwater gravel bar with flooded scrub.',
        tactical_advice: {
          recommended_baits_or_lures: ['Spinnerbait 1/2 oz', 'Weedless soft swimbait'],
          presentation_tips: 'Slow-roll through the submerged scrub on the D7 island point.',
          best_time_of_day: 'Afternoon',
        },
        target_species_fit: ['pike', 'black_bass'],
        restriction_status: 'permit_required',
        avg_rating: 4.6,
        review_count: 2,
      },
      {
        id: 'spot-tous-5',
        rank: 5,
        cell_id: 'G5',
        coordinates: { latitude: 39.1552, longitude: -0.6462 },
        title: 'Eastern Pocket Bay & Shore Shelf',
        confidence_score: 85,
        spot_category: 'shore_cove',
        feature_tags: ['Sheltered Cove', 'Shoreline Access', 'Carp & Barbel Flat'],
        why_this_spot:
          'Calm eastern pocket protected from wind, warming rapidly in spring and autumn.',
        tactical_advice: {
          recommended_baits_or_lures: ['Method feeder with pellets', 'Wacky-rigged senko'],
          presentation_tips: 'Cast toward the transition between the island tail and the G5 bay.',
          best_time_of_day: 'All day',
        },
        target_species_fit: ['carp', 'barbel', 'black_bass'],
        restriction_status: 'permit_required',
        avg_rating: 4.6,
        review_count: 1,
      },
      {
        id: 'spot-tous-6',
        rank: 6,
        cell_id: 'C6',
        coordinates: { latitude: 39.1468, longitude: -0.6785 },
        title: 'Western Peninsula Cove Mouth',
        confidence_score: 83,
        spot_category: 'shore_cove',
        feature_tags: ['Western Shore Access', 'Gravel Point', 'Feeder & Spinning'],
        why_this_spot:
          'Accessible western shoreline point flanked by two shallow spawning coves.',
        tactical_advice: {
          recommended_baits_or_lures: ['Topwater popper', 'Sweetcorn & boilie hair rig'],
          presentation_tips: 'Fish the C6 point tip at dawn or ledger in the adjacent bay.',
          best_time_of_day: 'Early morning',
        },
        target_species_fit: ['black_bass', 'carp'],
        restriction_status: 'permit_required',
        avg_rating: 4.5,
        review_count: 1,
      },
    ],
    reviews: [
      {
        id: 'rev-tous-1',
        waterBodyId: 'wb-es-tous-valencia',
        spotId: 'spot-tous-1',
        cellId: 'F5',
        userId: 'user-vicente',
        authorName: 'Vicente L. (Valencia)',
        rating: 5,
        comment:
          'Fished the submerged island at Spot #1 (F5) and the canyon mouth at Spot #2 (D4)—landed four bass up to 2.4kg and a 92cm pike!',
        fishingTypeUsed: 'spinning',
        speciesCaught: [
          { species: 'black_bass', count: 4, lengthCm: 53, weightKg: 2.4 },
          { species: 'pike', count: 1, lengthCm: 92, weightKg: 6.5 },
        ],
        fishedOn: '2026-11-07',
        createdAt: '2026-11-07T17:15:00Z',
        photos: [],
      },
    ],
  },
  {
    id: 'wb-pl-zegrzynskie',
    osmId: 'relation/1429801',
    name: 'Jezioro Zegrzyńskie',
    regionLabel: 'Mazowieckie, Poland',
    waterType: 'freshwater',
    countryCode: 'PL',
    centerLat: 52.452,
    centerLng: 21.035,
    avgRating: 4.6,
    reviewCount: 18,
    commonSpecies: ['zander', 'pike', 'perch', 'bream', 'catfish', 'asp'],
    description:
      'Lowland reservoir at the confluence of the Narew and Bug rivers north of Warsaw. Known for submerged river channel drop-offs (4m–9m), reed-lined bays around Nieporęt, and strong zander, perch, pike, and bream populations.',
    bbox: [21.005, 52.435, 21.065, 52.468],
    polygon: {
      type: 'Feature',
      properties: { name: 'Jezioro Zegrzyńskie', natural: 'water' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [21.005, 52.440],
            [21.020, 52.435],
            [21.055, 52.438],
            [21.065, 52.452],
            [21.050, 52.468],
            [21.006, 52.467],
            [21.005, 52.440],
          ],
        ],
      },
    },
    restrictionZones: [
      {
        id: 'rz-pl-zegrze-dam',
        cellId: 'A1',
        status: 'prohibited',
        reason:
          '50m Hydrotechnical Dam & Weir Safety Zone (Zapora Dębe / Port Zegrze lock buffer — fishing strictly prohibited).',
        source: 'osm',
        bounds: [21.005, 52.463, 21.015, 52.468],
      },
      {
        id: 'rz-pl-zegrze-pzw',
        status: 'permit_required',
        reason:
          'Managed by PZW Okręg Mazowiecki. Valid Karta Wędkarska and PZW Mazowiecki permit (Zezwolenie) required.',
        source: 'official',
      },
    ],
    preSeededSpots: [
      {
        id: 'spot-zegrze-c4',
        rank: 1,
        cell_id: 'C4',
        coordinates: { latitude: 52.453, longitude: 21.024 },
        title: 'Old Narew Channel Drop-Off (Nieporęt Slope)',
        confidence_score: 93,
        spot_category: 'primary_hot',
        feature_tags: ['9m River Channel Drop-off', 'Hard Mussel Bed', 'Zander & Perch'],
        why_this_spot:
          'The submerged Narew river bed drops sharply from 2.8m to 6.5m along a hard mussel-shell bottom, holding active zander and large perch schools.',
        tactical_advice: {
          recommended_baits_or_lures: [
            '10cm chartreuse/motor-oil soft shad on 12–18g jig head',
            'Blade bait (cicada) 14g for bottom contact',
          ],
          presentation_tips:
            'Cast across the old channel ledge and work the lure with a double-hop pause along the hard bottom.',
          best_time_of_day: 'First 2 hours after dawn and dusk twilight',
        },
        target_species_fit: ['zander', 'perch', 'pike'],
        restriction_status: 'permit_required',
        avg_rating: 4.8,
        review_count: 9,
      },
      {
        id: 'spot-zegrze-e3',
        rank: 2,
        cell_id: 'E3',
        coordinates: { latitude: 52.457, longitude: 21.038 },
        title: 'Bug–Narew Confluence Submerged Bar',
        confidence_score: 90,
        spot_category: 'primary_hot',
        feature_tags: ['Confluence Current Seam', 'Submerged Sandbar', 'Trophy Catfish & Asp'],
        why_this_spot:
          'Main basin current convergence creating a 7m scour hole bordered by a 3m gravel bar.',
        tactical_advice: {
          recommended_baits_or_lures: [
            'Heavy sinking minnow 8cm for asp',
            '12cm paddle-tail shad on 20g jig head for zander/catfish',
          ],
          presentation_tips: 'Fan-cast the current seam in E3 and let the jig swing down the drop.',
          best_time_of_day: 'Dawn and sunset',
        },
        target_species_fit: ['zander', 'asp', 'catfish'],
        restriction_status: 'permit_required',
        avg_rating: 4.7,
        review_count: 5,
      },
      {
        id: 'spot-zegrze-f6',
        rank: 3,
        cell_id: 'F6',
        coordinates: { latitude: 52.445, longitude: 21.046 },
        title: 'Southern Reed Bay & Pier Margin',
        confidence_score: 88,
        spot_category: 'shore_cove',
        feature_tags: ['Shoreline Reed Bed', 'Warm Shallow Shelf', 'Feeder Bream & Pike'],
        why_this_spot:
          'Sheltered shallow shelf (1.5m–2.5m) with dense reed beds and warm inflow water attracting roach, bream, and ambush pike.',
        tactical_advice: {
          recommended_baits_or_lures: [
            'Method feeder with sweet corn & krill groundbait',
            '12cm suspending jerkbait along the reed line',
          ],
          presentation_tips:
            'Clip up your feeder at 38m right at the silt-to-sand transition or twitch lures parallel to the reeds.',
          best_time_of_day: 'Early morning until 10:00 AM',
        },
        target_species_fit: ['pike', 'bream', 'perch'],
        restriction_status: 'permit_required',
        avg_rating: 4.5,
        review_count: 9,
      },
      {
        id: 'spot-zegrze-d5',
        rank: 4,
        cell_id: 'D5',
        coordinates: { latitude: 52.449, longitude: 21.031 },
        title: 'Mid-Lake Mussel Plateau',
        confidence_score: 85,
        spot_category: 'structure_ledge',
        feature_tags: ['Zebra Mussel Plateau', '3.5m Hard Bottom', 'Schooling Perch'],
        why_this_spot:
          'Raised hard plateau in the central basin covered in zebra mussels where big striped perch feed.',
        tactical_advice: {
          recommended_baits_or_lures: ['Drop-shot goby imitation', '7cm craw on Ned rig'],
          presentation_tips: 'Drag slowly across the hard shell patch in D5.',
          best_time_of_day: 'Mid-morning',
        },
        target_species_fit: ['perch', 'zander'],
        restriction_status: 'permit_required',
        avg_rating: 4.6,
        review_count: 3,
      },
    ],
    reviews: [
      {
        id: 'rev-zegrze-1',
        waterBodyId: 'wb-pl-zegrzynskie',
        spotId: 'spot-zegrze-c4',
        cellId: 'C4',
        userId: 'user-marek',
        authorName: 'Marek K.',
        rating: 5,
        comment:
          'Landed two zander (64cm and 71cm) and five big perch on the channel drop-off in cell C4 using a 15g jig head with a chartreuse shad!',
        fishingTypeUsed: 'spinning',
        speciesCaught: [
          { species: 'zander', count: 2, lengthCm: 71, weightKg: 3.4 },
          { species: 'perch', count: 5, lengthCm: 34, weightKg: 0.6 },
        ],
        fishedOn: '2026-10-28',
        createdAt: '2026-10-29T08:15:00Z',
        photos: [
          {
            id: 'photo-zegrze-1',
            storagePath: 'seed/zegrze-zander-c4.webp',
            publicUrl:
              'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80',
            photoType: 'catch',
          },
        ],
      },
      {
        id: 'rev-zegrze-2',
        waterBodyId: 'wb-pl-zegrzynskie',
        spotId: 'spot-zegrze-f6',
        cellId: 'F6',
        userId: 'user-piotr',
        authorName: 'Piotr W.',
        rating: 4,
        comment:
          'Great feeder session from the southern bank. Plenty of bronze bream up to 2kg and a 68cm pike followed the cage on retrieve.',
        fishingTypeUsed: 'feeder_bottom',
        speciesCaught: [{ species: 'bream', count: 6, lengthCm: 52, weightKg: 2.1 }],
        fishedOn: '2026-11-02',
        createdAt: '2026-11-02T17:40:00Z',
        photos: [],
      },
    ],
  },
  {
    id: 'wb-pl-wisla-warszawa',
    osmId: 'way/23910422',
    name: 'Wisła — Warszawa (Groynes Sector)',
    regionLabel: 'Warszawa, Poland',
    waterType: 'freshwater',
    countryCode: 'PL',
    centerLat: 52.218,
    centerLng: 21.072,
    avgRating: 4.7,
    reviewCount: 12,
    commonSpecies: ['asp', 'zander', 'chub', 'barbel', 'catfish', 'pike'],
    description:
      'Wild stone-groyne (główki) stretch of the Vistula River in Warsaw. Deep scour holes behind wing dykes, current seams, and sandy bars offer premier spinning and river feeder angling.',
    bbox: [20.85, 52.10, 21.25, 52.35],
    polygon: {
      type: 'Feature',
      properties: { name: 'Wisła', waterway: 'river' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [21.050, 52.198],
            [21.095, 52.198],
            [21.095, 52.238],
            [21.050, 52.238],
            [21.050, 52.198],
          ],
        ],
      },
    },
    restrictionZones: [
      {
        id: 'rz-pl-wisla-reserve',
        cellId: 'B2',
        status: 'prohibited',
        reason:
          'Rezerwat Przyrody Wyspy Zawadowskie / Bird Sanctuary Island — entry and bank angling prohibited.',
        source: 'osm',
      },
    ],
    preSeededSpots: [
      {
        id: 'spot-wisla-d4',
        rank: 1,
        cell_id: 'D4',
        coordinates: { latitude: 52.219, longitude: 21.071 },
        title: 'Siekierki Stone Groyne Tip & Eddy Seam',
        confidence_score: 91,
        spot_category: 'primary_hot',
        feature_tags: ['Stone Groyne Tip', '5m Scour Pool', 'Current Shear Line'],
        why_this_spot:
          'Strong main-current shear line meets a 5m slack-water eddy behind the submerged stone groyne tip—prime ambush point for asp by day and zander at dusk.',
        tactical_advice: {
          recommended_baits_or_lures: [
            '7–9cm heavy sinking minnow (asp)',
            '9cm slim shad on 15g jig head along the eddy edge',
          ],
          presentation_tips:
            'Cast upstream onto the groyne crest and sweep the lure across the current rip into the slack water.',
          best_time_of_day: 'Sunrise and first hour after sunset',
        },
        target_species_fit: ['asp', 'zander', 'chub'],
        restriction_status: 'permit_required',
        avg_rating: 4.7,
        review_count: 12,
      },
    ],
    reviews: [
      {
        id: 'rev-wisla-1',
        waterBodyId: 'wb-pl-wisla-warszawa',
        spotId: 'spot-wisla-d4',
        cellId: 'D4',
        userId: 'user-tomek',
        authorName: 'Tomek Z.',
        rating: 5,
        comment:
          'Explosive surface strikes from asp right on the current seam at the groyne tip! Landed a 73cm asp on a fast-retrieved wobbler.',
        fishingTypeUsed: 'spinning',
        speciesCaught: [{ species: 'asp', count: 1, lengthCm: 73, weightKg: 3.8 }],
        fishedOn: '2026-10-19',
        createdAt: '2026-10-19T19:00:00Z',
        photos: [],
      },
    ],
  },
  {
    id: 'wb-pl-zatoka-gdanska',
    osmId: 'relation/3819201',
    name: 'Zatoka Gdańska — Półwysep Helski',
    regionLabel: 'Pomorskie, Poland (Baltic Sea)',
    waterType: 'sea',
    countryCode: 'PL',
    centerLat: 54.695,
    centerLng: 18.675,
    avgRating: 4.5,
    reviewCount: 9,
    commonSpecies: ['sea_trout', 'garfish', 'flounder', 'perch', 'cod'],
    description:
      'Coastal Baltic Sea waters along the Hel Peninsula featuring alternating sandy troughs ("rewy"), stone breakwaters, and seagrass flats famous for wading sea trout, garfish, and surfcasting flounder.',
    bbox: [18.55, 54.60, 18.82, 54.78],
    polygon: {
      type: 'Feature',
      properties: { name: 'Zatoka Gdańska', natural: 'coastline' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [18.64, 54.67],
            [18.71, 54.67],
            [18.71, 54.72],
            [18.64, 54.72],
            [18.64, 54.67],
          ],
        ],
      },
    },
    restrictionZones: [
      {
        id: 'rz-pl-hel-port',
        cellId: 'H1',
        status: 'prohibited',
        reason: 'Military & Naval Port Buffer Zone — fishing prohibited.',
        source: 'osm',
      },
    ],
    preSeededSpots: [
      {
        id: 'spot-hel-c3',
        rank: 1,
        cell_id: 'C3',
        coordinates: { latitude: 54.698, longitude: 18.668 },
        title: 'Second Sandbar Trough & Leopard Bottom',
        confidence_score: 89,
        spot_category: 'primary_hot',
        feature_tags: ['Leopard Weed Bottom', 'Second Sandbar Trough', 'Wading Sea Trout'],
        why_this_spot:
          'Dark bladderwrack and mussel patches ("leopard bottom") breaks the second sandbar within wading casting distance, holding cruising sea trout and garfish.',
        tactical_advice: {
          recommended_baits_or_lures: [
            '18–24g long-cast coastal inline spoon (silver/green)',
            'Ragworm / sandeel rig on 100g grip lead for flounder',
          ],
          presentation_tips:
            'Wade to the first sandbar and cast parallel to the dark weed patches with intermittent spin-stops.',
          best_time_of_day: 'Mid-morning with light onshore ripple',
        },
        target_species_fit: ['sea_trout', 'garfish', 'flounder'],
        restriction_status: 'allowed',
        avg_rating: 4.5,
        review_count: 9,
      },
    ],
    reviews: [
      {
        id: 'rev-hel-1',
        waterBodyId: 'wb-pl-zatoka-gdanska',
        spotId: 'spot-hel-c3',
        cellId: 'C3',
        userId: 'user-kamil',
        authorName: 'Kamil B.',
        rating: 5,
        comment:
          'Silver 62cm sea trout hit an inline spoon right over the dark weed bed in cell C3 while wading!',
        fishingTypeUsed: 'spinning',
        speciesCaught: [{ species: 'sea_trout', count: 1, lengthCm: 62, weightKg: 2.7 }],
        fishedOn: '2026-11-01',
        createdAt: '2026-11-01T15:20:00Z',
        photos: [],
      },
    ],
  },
  {
    id: 'wb-es-mequinenza',
    osmId: 'relation/2901844',
    name: 'Embalse de Mequinenza (Mar de Aragón)',
    regionLabel: 'Aragón, Spain',
    waterType: 'freshwater',
    countryCode: 'ES',
    centerLat: 41.355,
    centerLng: 0.255,
    avgRating: 4.9,
    reviewCount: 27,
    commonSpecies: ['catfish', 'zander', 'carp', 'black_bass', 'perch'],
    description:
      'Spain’s premier Ebro reservoir ("Mar de Aragón"). Famous across Europe for trophy Wels catfish over 2 meters, huge carp, abundant zander along drowned limestone cliffs, and black bass in flooded coves.',
    bbox: [0.05, 41.25, 0.35, 41.42],
    polygon: {
      type: 'Feature',
      properties: { name: 'Embalse de Mequinenza', natural: 'water' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0.220, 41.335],
            [0.290, 41.335],
            [0.290, 41.375],
            [0.220, 41.375],
            [0.220, 41.335],
          ],
        ],
      },
    },
    restrictionZones: [
      {
        id: 'rz-es-mequinenza-dam',
        cellId: 'H8',
        status: 'prohibited',
        reason:
          'Presa de Mequinenza Hydroelectric Safety Exclusion Zone — boat and bank fishing prohibited.',
        source: 'osm',
      },
      {
        id: 'rz-es-mequinenza-coto',
        status: 'permit_required',
        reason:
          'Requires Aragón regional Licencia de Pesca plus Coto Deportivo Mar de Aragón ticket. Live bait and night fishing subject to strict regional invasive-species regulations.',
        source: 'official',
      },
    ],
    preSeededSpots: [
      {
        id: 'spot-mequinenza-d3',
        rank: 1,
        cell_id: 'D3',
        coordinates: { latitude: 41.358, longitude: 0.246 },
        title: 'Submerged Limestone Terrace & Old Olive Grove Ledge',
        confidence_score: 96,
        spot_category: 'primary_hot',
        feature_tags: ['14m Limestone Ledge', 'Submerged Olive Grove', 'Trophy Catfish & Zander'],
        why_this_spot:
          'Steep flooded limestone step dropping from 4m to 14m adjacent to a silted bay mouth—concentrates giant catfish, zander schools, and feeding common carp.',
        tactical_advice: {
          recommended_baits_or_lures: [
            'Halibut pellets (28mm) on heavy ledger rig for catfish/carp',
            '12cm white/pearl paddle-tail shad on 20g jig head for zander',
          ],
          presentation_tips:
            'Position rigs at the base of the 9m shelf or vertical/cast-jig along the submerged stone wall.',
          best_time_of_day: 'Late afternoon until legal sunset boundary',
        },
        target_species_fit: ['catfish', 'zander', 'carp'],
        restriction_status: 'permit_required',
        avg_rating: 4.9,
        review_count: 16,
      },
      {
        id: 'spot-mequinenza-e2',
        rank: 2,
        cell_id: 'E2',
        coordinates: { latitude: 41.366, longitude: 0.258 },
        title: 'Flooded Tamarisk Cove (Black Bass Pocket)',
        confidence_score: 90,
        spot_category: 'shore_cove',
        feature_tags: ['Flooded Tamarisk Brush', 'Warm Cove', 'Shore & Kayak Access'],
        why_this_spot:
          'Sun-warmed shallow limestone cove with submerged brush and boulders providing prime cover for largemouth black bass.',
        tactical_advice: {
          recommended_baits_or_lures: [
            'Texas-rigged creature bait / craw in watermelon red',
            'Suspending jerkbait or spinnerbait over submerged timber',
          ],
          presentation_tips:
            'Pitch weedless plastics tight into the flooded bushes and pause on the drop.',
          best_time_of_day: 'Morning sun warming the northern bank',
        },
        target_species_fit: ['black_bass', 'zander'],
        restriction_status: 'permit_required',
        avg_rating: 4.8,
        review_count: 11,
      },
    ],
    reviews: [
      {
        id: 'rev-mequinenza-1',
        waterBodyId: 'wb-es-mequinenza',
        spotId: 'spot-mequinenza-d3',
        cellId: 'D3',
        userId: 'user-carlos',
        authorName: 'Carlos M.',
        rating: 5,
        comment:
          'Incredible session on the limestone ledge in cell D3! Caught a 2.15m Wels catfish on pellets and three zander on white shads.',
        fishingTypeUsed: 'carp',
        speciesCaught: [
          { species: 'catfish', count: 1, lengthCm: 215, weightKg: 68.0 },
          { species: 'zander', count: 3, lengthCm: 66, weightKg: 2.9 },
        ],
        fishedOn: '2026-10-25',
        createdAt: '2026-10-26T10:12:00Z',
        photos: [
          {
            id: 'photo-mequinenza-1',
            storagePath: 'seed/mequinenza-catfish-d3.webp',
            publicUrl:
              'https://images.unsplash.com/photo-1516962215378-7fa2e137ae93?auto=format&fit=crop&w=800&q=80',
            photoType: 'catch',
          },
        ],
      },
    ],
  },
  {
    id: 'wb-es-orellana',
    osmId: 'relation/3412990',
    name: 'Embalse de Orellana (Guadiana Basin)',
    regionLabel: 'Extremadura, Spain',
    waterType: 'freshwater',
    countryCode: 'ES',
    centerLat: 38.992,
    centerLng: -5.495,
    avgRating: 4.8,
    reviewCount: 15,
    commonSpecies: ['black_bass', 'pike', 'carp', 'barbel'],
    description:
      'Crystal-clear Blue Flag reservoir on the Guadiana River in Extremadura. World-renowned for giant pike, trophy black bass around rocky islands, and sight-fishing for Iberian barbel and carp.',
    bbox: [-5.525, 38.975, -5.465, 39.010],
    polygon: {
      type: 'Feature',
      properties: { name: 'Embalse de Orellana', natural: 'water' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-5.525, 38.978],
            [-5.465, 38.978],
            [-5.465, 39.008],
            [-5.525, 39.008],
            [-5.525, 38.978],
          ],
        ],
      },
    },
    restrictionZones: [
      {
        id: 'rz-es-orellana-swim',
        cellId: 'B2',
        status: 'prohibited',
        reason: 'Playa Costa Dulce Designated Bathing & Buoy Zone — angling prohibited inside buoys.',
        source: 'osm',
      },
    ],
    preSeededSpots: [
      {
        id: 'spot-orellana-e5',
        rank: 1,
        cell_id: 'E5',
        coordinates: { latitude: 38.988, longitude: -5.488 },
        title: 'Submerged Granite Point & Weed Edge',
        confidence_score: 94,
        spot_category: 'primary_hot',
        feature_tags: ['Granite Point', 'Elodea Weed Margin', 'Clear Water Trophy Pike'],
        why_this_spot:
          'Long granite rocky point extending into 8m of clear water bordered by oxygen-rich elodea weed beds—prime patrol route for metre-plus pike and big black bass.',
        tactical_advice: {
          recommended_baits_or_lures: [
            '16cm natural roach swimbait (pike)',
            'Finesse drop-shot or wacky worm in natural green pumpkin (bass)',
          ],
          presentation_tips:
            'Make long casts with fluorocarbon leader in the clear water and slow-roll along the outer weed line.',
          best_time_of_day: 'Dawn and late afternoon golden hour',
        },
        target_species_fit: ['pike', 'black_bass'],
        restriction_status: 'permit_required',
        avg_rating: 4.8,
        review_count: 15,
      },
    ],
    reviews: [
      {
        id: 'rev-orellana-1',
        waterBodyId: 'wb-es-orellana',
        spotId: 'spot-orellana-e5',
        cellId: 'E5',
        userId: 'user-javier',
        authorName: 'Javier R.',
        rating: 5,
        comment:
          'Clear water sight-fishing at its best! Landed a 98cm pike and two 2.2kg black bass off the granite point in cell E5.',
        fishingTypeUsed: 'spinning',
        speciesCaught: [
          { species: 'pike', count: 1, lengthCm: 98, weightKg: 7.4 },
          { species: 'black_bass', count: 2, lengthCm: 51, weightKg: 2.2 },
        ],
        fishedOn: '2026-11-04',
        createdAt: '2026-11-04T18:30:00Z',
        photos: [],
      },
    ],
  },
  {
    id: 'wb-es-costa-brava',
    osmId: 'way/48219300',
    name: 'Costa Brava — L’Escala & Montgrí Coast',
    regionLabel: 'Catalonia, Spain (Mediterranean Sea)',
    waterType: 'sea',
    countryCode: 'ES',
    centerLat: 42.118,
    centerLng: 3.155,
    avgRating: 4.7,
    reviewCount: 14,
    commonSpecies: ['sea_bass', 'dorada', 'sargo', 'bluefish', 'mackerel'],
    description:
      'Dramatic Mediterranean coastline mixing rocky headlands (rock-spinning for lubina/sea bass and sargo) with deep sandy bays ideal for surfcasting gilthead seabream (dorada).',
    bbox: [3.125, 42.098, 3.185, 42.138],
    polygon: {
      type: 'Feature',
      properties: { name: 'Costa Brava — L’Escala', natural: 'coastline' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [3.125, 42.100],
            [3.182, 42.100],
            [3.182, 42.135],
            [3.125, 42.135],
            [3.125, 42.100],
          ],
        ],
      },
    },
    restrictionZones: [
      {
        id: 'rz-es-montgri-reserve',
        cellId: 'G7',
        status: 'prohibited',
        reason:
          'Parc Natural del Montgrí / Reserva Marina Integral — strict no-take marine reserve.',
        source: 'osm',
      },
    ],
    preSeededSpots: [
      {
        id: 'spot-costabrava-c3',
        rank: 1,
        cell_id: 'C3',
        coordinates: { latitude: 42.123, longitude: 3.144 },
        title: 'Punta Montgó Whitewater Rocky Ledge',
        confidence_score: 92,
        spot_category: 'primary_hot',
        feature_tags: ['Whitewater Foam Ledge', 'Posidonia Drop-off', 'Sea Bass & Sargo'],
        why_this_spot:
          'Oxygenated whitewater foam over submerged posidonia and rocky drop-off attracts hunting European sea bass (lubina) and sargo.',
        tactical_advice: {
          recommended_baits_or_lures: [
            '120–140mm salt minnow (sardine/white pattern) or surface walker (Patchinko style)',
            'Whole crab or titas on sliding ledger rig in the sandy channel for dorada',
          ],
          presentation_tips:
            'Cast into the edge of the whitewater wash and retrieve with sharp jerks as waves recede.',
          best_time_of_day: 'Dawn swell and dusk',
        },
        target_species_fit: ['sea_bass', 'dorada', 'sargo'],
        restriction_status: 'permit_required',
        avg_rating: 4.7,
        review_count: 14,
      },
    ],
    reviews: [
      {
        id: 'rev-costabrava-1',
        waterBodyId: 'wb-es-costa-brava',
        spotId: 'spot-costabrava-c3',
        cellId: 'C3',
        userId: 'user-marc',
        authorName: 'Marc V.',
        rating: 5,
        comment:
          'Two sea bass (lubinas) at sunrise in the foam pocket of cell C3 on a topwater walker, plus a 1.8kg dorada from the adjacent beach!',
        fishingTypeUsed: 'spinning',
        speciesCaught: [
          { species: 'sea_bass', count: 2, lengthCm: 58, weightKg: 2.1 },
          { species: 'dorada', count: 1, lengthCm: 46, weightKg: 1.8 },
        ],
        fishedOn: '2026-11-05',
        createdAt: '2026-11-05T11:00:00Z',
        photos: [],
      },
    ],
  },
];
