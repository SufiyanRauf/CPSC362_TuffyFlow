// Campus data for Tuffy Flow.
//
// Shaped exactly like the database rows in db/schema.sql so that swapping in
// Supabase queries later only changes this file. Accessors are async for the
// same reason.
//
// Sources are recorded in db/seed_clubs.sql and db/seed_spots.sql.
// Coordinates are CSUF's own, from fullerton.edu/campusmap/locations.json, for
// all 17 buildings and 10 of the 12 lots. S8 and S10 and the Visitor Lot are
// not in that file, so those two are our estimates.

import type {
  Building, Profile, ClassMeeting, ParkingLot, LotAvailability,
  Spot, Club, CampusEvent,
} from '../types'

const buildings: Building[] = [
  { id: 'b-mh', code: "MH", name: "McCarthy Hall", lat: 33.879706, lng: -117.885573 },
  { id: 'b-lh', code: "LH", name: "Langsdorf Hall", lat: 33.879057, lng: -117.884333 },
  { id: 'b-pl', code: "PL", name: "Pollak Library", lat: 33.881414, lng: -117.885361 },
  { id: 'b-tsu', code: "TSU", name: "Titan Student Union", lat: 33.881795, lng: -117.888204 },
  { id: 'b-cs', code: "CS", name: "Computer Science", lat: 33.882349, lng: -117.88275 },
  { id: 'b-e', code: "E", name: "Engineering", lat: 33.882349, lng: -117.88329 },
  { id: 'b-dbh', code: "DBH", name: "Dan Black Hall", lat: 33.879305, lng: -117.885845 },
  { id: 'b-h', code: "H", name: "Humanities", lat: 33.88051, lng: -117.884151 },
  { id: 'b-ec', code: "EC", name: "Education Classroom", lat: 33.881386, lng: -117.884348 },
  { id: 'b-gh', code: "GH", name: "Gordon Hall", lat: 33.879666, lng: -117.884138 },
  { id: 'b-sgmh', code: "SGMH", name: "Steven G. Mihaylo Hall", lat: 33.878837, lng: -117.883428 },
  { id: 'b-tg', code: "TG", name: "Titan Gym", lat: 33.883132, lng: -117.886251 },
  { id: 'b-src', code: "SRC", name: "Student Recreation Center", lat: 33.883147, lng: -117.887846 },
  { id: 'b-va', code: "VA", name: "Visual Arts", lat: 33.880722, lng: -117.888976 },
  { id: 'b-khs', code: "KHS", name: "Kinesiology and Health Science", lat: 33.882697, lng: -117.886076 },
  // South of Nutwood Avenue. The campus map puts Avanti Markets at Nutwood Cafe
  // in this building, not in the Titan Student Union where we first had it.
  { id: 'b-cp', code: "CP", name: "College Park", lat: 33.877584, lng: -117.883445 },
  { id: 'b-b', code: "B", name: "Bookstore and Titan Shops", lat: 33.881893, lng: -117.886841 },
]

const parkingLots: ParkingLot[] = [
  { id: 'lot-0', name: "Nutwood Structure", lat: 33.879029, lng: -117.88852, permit_type: 'student', total_spaces: 2484 },
  { id: 'lot-1', name: "State College Structure", lat: 33.883055, lng: -117.888671, permit_type: 'student', total_spaces: 1373 },
  { id: 'lot-2', name: "Eastside North", lat: 33.880356, lng: -117.881687, permit_type: 'student', total_spaces: 1880 },
  // CSUF's map data still titles this one "Eastside Parking Structure 2 (Under
  // Construction)", but the availability board reports counts for it, so it
  // looks open and the map entry stale.
  { id: 'lot-3', name: "Eastside South", lat: 33.881079, lng: -117.881804, permit_type: 'student', total_spaces: 1341 },
  // Our estimate: not in CSUF's map data.
  { id: 'lot-4', name: "S8 and S10", lat: 33.8862, lng: -117.8848, permit_type: 'student', total_spaces: 2104 },
  { id: 'lot-5', name: "Lot A", lat: 33.887246, lng: -117.888922, permit_type: 'student', total_spaces: 420 },
  { id: 'lot-6', name: "Lot C", lat: 33.878331, lng: -117.88835, permit_type: 'student', total_spaces: 380 },
  { id: 'lot-7', name: "Lot D", lat: 33.884152, lng: -117.887855, permit_type: 'student', total_spaces: 310 },
  { id: 'lot-8', name: "Lot E", lat: 33.88188, lng: -117.881648, permit_type: 'student', total_spaces: 260 },
  { id: 'lot-9', name: "Lot G", lat: 33.888301, lng: -117.886538, permit_type: 'student', total_spaces: 340 },
  { id: 'lot-10', name: "Staff Lot J", lat: 33.88344, lng: -117.882967, permit_type: 'staff', total_spaces: 180 },
  // Our estimate: CSUF's map data has no visitor lot entry.
  { id: 'lot-11', name: "Visitor Lot", lat: 33.88, lng: -117.8895, permit_type: 'visitor', total_spaces: 120 },
]

// Mirrors the generate_series in db/seed.sql and has to stay in step with it.
// Hours 6 to 21, clamped to 0..99.
//
// The five counted structures are measured, from data/parking_samples.csv:
// Thursday 1 October 2026 13:11 for the weekday figure and Sunday 20 September
// 2026 12:23 for the weekend one. Both reproduce their reading to within a
// point. The two shapes are not the same curve scaled down. On a weekday
// Eastside fills to about 88 percent because it is closest to the academic
// buildings, while on a Sunday every structure is under 4 percent except
// S8 and S10 at 59, which sits by the stadium and the gym.
//
// Only Sunday was sampled, so Saturday is an assumption.
//
// The seven surface lots are not on the board. Those numbers are guesses.
const LOT_DEMAND: Record<string, { weekday: number; weekend: number }> = {
  "Nutwood Structure":           { weekday:  -24, weekend:  -1 },
  "State College Structure":     { weekday:  -31, weekend:   1 },
  "Eastside North":              { weekday:   12, weekend:  -3 },
  "Eastside South":              { weekday:   14, weekend:  -1 },
  "S8 and S10":                  { weekday:   -9, weekend:  56 },
  "Lot A":                       { weekday:  -18, weekend:   0 },
  "Lot C":                       { weekday:  -13, weekend:   0 },
  "Lot D":                       { weekday:   -3, weekend:   0 },
  "Lot E":                       { weekday:    0, weekend:   0 },
  "Lot G":                       { weekday:  -20, weekend:   0 },
  "Staff Lot J":                 { weekday:  -28, weekend:   0 },
  "Visitor Lot":                 { weekday:  -33, weekend:   0 },
}
function buildAvailability(): LotAvailability[] {
  const rows: LotAvailability[] = []
  for (const lot of parkingLots) {
    for (let day = 0; day <= 6; day++) {
      for (let hour = 6; hour <= 21; hour++) {
        const weekend = day === 0 || day === 6
        const demand = LOT_DEMAND[lot.name]
        const base = weekend
          ? 1 + Math.max(0, 3 - Math.abs(hour - 13))
          : hour < 8 ? 20 : hour > 18 ? 25 : 92 - Math.abs(hour - 11) * 9
        const offset = weekend ? demand?.weekend ?? 0 : demand?.weekday ?? 0
        rows.push({
          lot_id: lot.id, day_of_week: day, hour,
          // floor 2, ceiling 99: never claim a lot is literally empty or full.
          // Early and late the offsets exceed the base so the lots converge,
          // which is right, they really are all empty and the walk decides.
          typical_pct_full: Math.max(2, Math.min(99, base + offset)),
        })
      }
    }
  }
  return rows
}
const lotAvailability = buildAvailability()

const spots: Spot[] = [
  { id: 'spot-pl-library-north-1st-floor', name: "Library North 1st Floor", kind: 'study', building_id: 'b-pl', building_name: 'Pollak Library', floor: 1, section: 'North', noise_level: 4, has_outlets: true, is_indoor: true, seats: 120, reservable: false, opens_at: "07:00", closes_at: "23:59", hours_note: "Group study space, talking permitted. Mon to Thu 7am to 11:59pm, Fri 7am to 5pm, Sat and Sun 9am to 5pm" },
  { id: 'spot-pl-library-north-2nd-floor', name: "Library North 2nd Floor", kind: 'study', building_id: 'b-pl', building_name: 'Pollak Library', floor: 2, section: 'North', noise_level: 4, has_outlets: true, is_indoor: true, seats: 140, reservable: false, opens_at: "07:00", closes_at: "23:59", hours_note: "Group study space, talking permitted. Mon to Thu 7am to 11:59pm, Fri 7am to 5pm, Sat and Sun 9am to 5pm" },
  { id: 'spot-pl-library-north-3rd-floor', name: "Library North 3rd Floor", kind: 'study', building_id: 'b-pl', building_name: 'Pollak Library', floor: 3, section: 'North', noise_level: 1, has_outlets: true, is_indoor: true, seats: 90, reservable: false, opens_at: "07:00", closes_at: "23:59", hours_note: "Quiet study floor, phones off. Mon to Thu 7am to 11:59pm, Fri 7am to 5pm, Sat and Sun 9am to 5pm" },
  { id: 'spot-pl-library-north-4th-floor', name: "Library North 4th Floor", kind: 'study', building_id: 'b-pl', building_name: 'Pollak Library', floor: 4, section: 'North', noise_level: 3, has_outlets: true, is_indoor: true, seats: 110, reservable: false, opens_at: "07:00", closes_at: "23:59", hours_note: "Group study space, talking permitted. Mon to Thu 7am to 11:59pm, Fri 7am to 5pm, Sat and Sun 9am to 5pm" },
  { id: 'spot-pl-library-south-4th-floor', name: "Library South 4th Floor", kind: 'study', building_id: 'b-pl', building_name: 'Pollak Library', floor: 4, section: 'South', noise_level: 1, has_outlets: true, is_indoor: true, seats: 80, reservable: false, opens_at: "07:00", closes_at: "23:59", hours_note: "Quiet study floor, phones off. Mon to Thu 7am to 11:59pm, Fri 7am to 5pm, Sat and Sun 9am to 5pm" },
  { id: 'spot-pl-library-south-5th-floor', name: "Library South 5th Floor", kind: 'study', building_id: 'b-pl', building_name: 'Pollak Library', floor: 5, section: 'South', noise_level: 3, has_outlets: true, is_indoor: true, seats: 100, reservable: false, opens_at: "07:00", closes_at: "23:59", hours_note: "Group study space, talking permitted. Mon to Thu 7am to 11:59pm, Fri 7am to 5pm, Sat and Sun 9am to 5pm" },
  { id: 'spot-pl-group-study-rooms', name: "Group Study Rooms", kind: 'meet', building_id: 'b-pl', building_name: 'Pollak Library', floor: 1, section: 'North', noise_level: 3, has_outlets: true, is_indoor: true, seats: 6, reservable: true, opens_at: "07:00", closes_at: "23:59", hours_note: "Bookable in 2 hour slots, 7am to 11pm. Groups of 2 or more need a second CWID. Up to 5 bookings a week, 2 weeks ahead." },
  { id: 'spot-pl-student-genius-center', name: "Student Genius Center", kind: 'charge', building_id: 'b-pl', building_name: 'Pollak Library', floor: 1, section: 'North', noise_level: 3, has_outlets: true, is_indoor: true, seats: 20, reservable: false, opens_at: "07:00", closes_at: "22:00", hours_note: "Laptop checkout and tech help. Mon to Thu 7am to 10pm, Fri 7am to 5pm, Sat 9am to 5pm, closed Sunday. Pollak Library North, first floor." },
  { id: "spot-eat-avanti-markets-at-nutwood-cafe", name: "Avanti Markets at Nutwood Cafe", kind: 'eat', building_id: 'b-cp', building_name: "College Park", floor: null, section: null, noise_level: 3, has_outlets: true, is_indoor: true, seats: 40, reservable: false, opens_at: "07:00", closes_at: "20:00", hours_note: "Mon to Thu 7am to 8pm, Fri 7am to 5pm. Grab and go snacks and drinks." },
  { id: "spot-eat-baja-fresh-express", name: "Baja Fresh Express", kind: 'eat', building_id: 'b-tsu', building_name: "Titan Student Union", floor: null, section: null, noise_level: 5, has_outlets: false, is_indoor: true, seats: 60, reservable: false, opens_at: "10:00", closes_at: "17:00", hours_note: "Mon to Thu 10am to 5pm" },
  { id: "spot-eat-carl-s-jr", name: "Carl's Jr.", kind: 'eat', building_id: 'b-gh', building_name: "Gordon Hall", floor: null, section: null, noise_level: 4, has_outlets: false, is_indoor: true, seats: 50, reservable: false, opens_at: "08:00", closes_at: "19:00", hours_note: "Mon to Thu 8am to 7pm, Fri 8am to 2pm. Near Gordon Hall." },
  { id: "spot-eat-fresh-kitchen", name: "Fresh Kitchen", kind: 'eat', building_id: 'b-tsu', building_name: "Titan Student Union", floor: null, section: null, noise_level: 5, has_outlets: false, is_indoor: true, seats: 40, reservable: false, opens_at: "10:00", closes_at: "15:00", hours_note: "Mon to Thu 10am to 3pm, Fri 10am to 2pm" },
  { id: "spot-eat-hibachi-san", name: "Hibachi-San", kind: 'eat', building_id: 'b-tsu', building_name: "Titan Student Union", floor: null, section: null, noise_level: 5, has_outlets: false, is_indoor: true, seats: 40, reservable: false, opens_at: "09:00", closes_at: "19:00", hours_note: "Mon to Thu 9am to 7pm, Fri 9am to 2pm" },
  { id: "spot-eat-juice-it-up", name: "Juice It Up!", kind: 'eat', building_id: 'b-tsu', building_name: "Titan Student Union", floor: null, section: null, noise_level: 4, has_outlets: false, is_indoor: true, seats: 15, reservable: false, opens_at: "08:30", closes_at: "18:30", hours_note: "Mon to Thu 8:30am to 6:30pm, Fri 8:30am to 1:30pm" },
  { id: "spot-eat-on-campus-food-trucks", name: "On-Campus Food Trucks", kind: 'eat', building_id: 'b-h', building_name: "Humanities", floor: null, section: null, noise_level: 4, has_outlets: false, is_indoor: false, seats: 30, reservable: false, opens_at: "11:00", closes_at: "13:00", hours_note: "Mon to Thu 11am to 1pm, Humanities Plaza" },
  { id: "spot-eat-panda-express", name: "Panda Express", kind: 'eat', building_id: 'b-tsu', building_name: "Titan Student Union", floor: null, section: null, noise_level: 5, has_outlets: false, is_indoor: true, seats: 60, reservable: false, opens_at: "09:00", closes_at: "19:00", hours_note: "Mon to Thu 9am to 7pm, Fri 9am to 2pm" },
  { id: "spot-eat-pieology", name: "Pieology", kind: 'eat', building_id: 'b-tsu', building_name: "Titan Student Union", floor: null, section: null, noise_level: 5, has_outlets: false, is_indoor: true, seats: 50, reservable: false, opens_at: "10:00", closes_at: "18:00", hours_note: "Mon to Thu 10am to 6pm, Fri 10am to 2pm" },
  { id: "spot-eat-starbucks-mihaylo-hall", name: "Starbucks Mihaylo Hall", kind: 'eat', building_id: 'b-sgmh', building_name: "Steven G. Mihaylo Hall", floor: null, section: null, noise_level: 4, has_outlets: true, is_indoor: true, seats: 35, reservable: false, opens_at: "08:00", closes_at: "19:00", hours_note: "Mon to Thu 8am to 7pm" },
  { id: "spot-eat-starbucks-pollak-library", name: "Starbucks Pollak Library", kind: 'eat', building_id: 'b-pl', building_name: "Pollak Library", floor: null, section: null, noise_level: 4, has_outlets: true, is_indoor: true, seats: 30, reservable: false, opens_at: "07:30", closes_at: "19:00", hours_note: "Mon to Thu 7:30am to 7pm, Fri 8am to 2pm" },
  { id: "spot-eat-starbucks-titan-student-union", name: "Starbucks Titan Student Union", kind: 'eat', building_id: 'b-tsu', building_name: "Titan Student Union", floor: null, section: null, noise_level: 4, has_outlets: true, is_indoor: true, seats: 45, reservable: false, opens_at: "08:00", closes_at: "17:00", hours_note: "Mon to Thu 8am to 5pm, Fri 8am to 1pm" },
  { id: "spot-eat-togo-s", name: "TOGO'S", kind: 'eat', building_id: 'b-tsu', building_name: "Titan Student Union", floor: null, section: null, noise_level: 4, has_outlets: false, is_indoor: true, seats: 40, reservable: false, opens_at: "10:00", closes_at: "18:00", hours_note: "Mon to Thu 10am to 6pm, Fri 10am to 2pm" },
  // The three Titan Shops convenience stores. Campus Dining lists them but
  // sends you to titanshops.com for the hours. Titan Shops is the only campus
  // food location that opens on a Saturday.
  { id: "spot-eat-the-brief-stop", name: "The Brief Stop at Langsdorf Hall", kind: 'eat', building_id: 'b-lh', building_name: "Langsdorf Hall", floor: null, section: null, noise_level: 3, has_outlets: false, is_indoor: true, seats: 10, reservable: false, opens_at: "07:30", closes_at: "21:00", hours_note: "Mon to Thu 7:30am to 9pm, Fri 7:30am to 2pm. Closed weekends. Convenience store." },
  { id: "spot-eat-the-express", name: "The Express at Titan Shops", kind: 'eat', building_id: 'b-b', building_name: "Bookstore and Titan Shops", floor: null, section: null, noise_level: 3, has_outlets: false, is_indoor: true, seats: 10, reservable: false, opens_at: "07:30", closes_at: "19:00", hours_note: "Mon to Thu 7:30am to 7pm, Fri 7:30am to 5pm, Sat 10am to 3pm. Convenience store." },
  { id: "spot-eat-the-yum", name: "The Yum at the TSU", kind: 'eat', building_id: 'b-tsu', building_name: "Titan Student Union", floor: null, section: null, noise_level: 3, has_outlets: false, is_indoor: true, seats: 10, reservable: false, opens_at: "09:00", closes_at: "21:00", hours_note: "Mon to Thu 9am to 9pm, Fri 9am to 2pm. Closed weekends. Convenience store." },
]

const clubs: Club[] = [
  { id: 'club-134874', titanlink_id: "134874", name: "California Geotechnical Engineering Association", summary: "The purpose of this organization is to support initiative of the Geo-Institute to increase student membership and participation. Increase awareness among civil engineering undergraduates of the Geotechnical field and graduate school opportunities.", website_key: "calgeo", categories: ["College of Engineering and Computer Science"], tags: ["engineering"] },
  { id: 'club-430732', titanlink_id: "430732", name: "Titan Product Management Club", summary: "Titan Product Management Club is a student organization dedicated to developing the next generation of product leaders through hands-on workshops, industry speaker events, and a community of driven peers passionate about building innovative products.", website_key: "titan-product-management-club", categories: ["College of Engineering and Computer Science", "College of Business and Economics", "Technology"], tags: ["business", "engineering", "technology"] },
  { id: 'club-404632', titanlink_id: "404632", name: "National Organization of Black Chemists and Chemical Engineers", summary: "The purpose of this student chapter shall be consistent with the objectives NOBCChE. The objectives of NOBCChE, as established in the Certificate of Incorporation, are: to further the application of chemistry, chemical engineering and relate", website_key: "nobcche", categories: ["Cultural", "College of Natural Science and Mathematics"], tags: ["cultural", "engineering"] },
  { id: 'club-135321', titanlink_id: "135321", name: "Institute of Transportation Engineers", summary: "The Institute of Transportation Engineers of California State University, Fullerton promotes education and professional development of those interested in transportation engineering.", website_key: "ite", categories: ["College of Engineering and Computer Science"], tags: ["career", "engineering", "leadership"] },
  { id: 'club-181118', titanlink_id: "181118", name: "Student Academy of Audiology at California State University, Fullerton", summary: "The mission of the Student Academy of Audiology Chapter at CSUF is to advance the rights, interests, and welfare of students interested in pursuing a career in audiology.", website_key: "saaatcsuf", categories: ["Special Interest", "College of Communications", "Health & Wellness", "Technology"], tags: ["health-wellness", "technology"] },
  { id: 'club-134228', titanlink_id: "134228", name: "American Society of Civil Engineers", summary: "ASCE is the nation's oldest engineering society, and promotes success within the civil engineering field. Networking, educational tours, internships and social events are just a few things ASCE has to offer civil engineering students at CSUF.", website_key: "asce", categories: ["Honor Society", "Service", "Special Interest", "College of Engineering and Computer Science"], tags: ["career", "engineering", "service"] },
  { id: 'club-145650', titanlink_id: "145650", name: "Titan TV", summary: "CSUF's premier television channel, Titan TV, cable casts over Channel 98 on Time Warner Cable and AT&T U-Verse in Fullerton, Placentia, Santa Ana, Buena Park, Seal Beach, and Newport Beach.  Become a member to help boost awareness of Titan TV on campus.", website_key: "titantv", categories: ["Special Interest", "Career Planning", "College of Communications", "College of the Arts", "Technology"], tags: ["career", "technology"] },
  { id: 'club-138410', titanlink_id: "138410", name: "CSUF Gaming & Esports", summary: "Gaming Club & Esports hopes to foster and promote a welcoming environment to introduce students at California State University, Fullerton to gaming culture.", website_key: "csufesports", categories: ["Service", "Special Interest", "Sport", "Recreation", "Social", "Technology"], tags: ["recreation", "service", "sport", "technology"] },
  { id: 'club-135930', titanlink_id: "135930", name: "Business and Data Analytics Club", summary: "BDAC is a pan-university student organization that targets mainly on the technologies and innovations in the field of data sciences and business analytics.", website_key: "bdac", categories: ["Special Interest", "College of Business and Economics", "Technology"], tags: ["business", "data-science", "technology"] },
  { id: 'club-382503', titanlink_id: "382503", name: "Adobe @ Fullerton", summary: "This club is to have a creative space for students to express themselves through art using Adobe's programs from the Creative Cloud. Students can socialize with fellow peers in the club while doing recreational activities.", website_key: "adobe_fullerton", categories: ["Special Interest", "Recreation", "College of the Arts", "College of Business and Economics", "Social", "Technology"], tags: ["business", "recreation", "technology"] },
  { id: 'club-403163', titanlink_id: "403163", name: "Titan Underwater Robotics at California State University, Fullerton", summary: "Titan Underwater Robotics at CSUF, sponsored by RJE International, Inc., develops innovative submersible vehicles for ROV competitions, advancing marine robotics through collaborative student projects.", website_key: "titanunderwaterrobics", categories: ["College of Engineering and Computer Science", "Technology"], tags: ["engineering", "programming", "technology"] },
  { id: 'club-414916', titanlink_id: "414916", name: "Technology and Business solutions", summary: "Tech & Business Solutions Club: We explore tech-driven business strategies through software services, mock business modeling, and data analysis. Hands-on learning for future innovators.", website_key: "tbsclub", categories: ["Fraternity & Sorority", "Career Planning", "College of Engineering and Computer Science", "College of Business and Economics", "Technology"], tags: ["business", "career", "engineering", "startups", "technology"] },
  { id: 'club-424998', titanlink_id: "424998", name: "Marvel Rivals Club", summary: "Marvel Rivals Club brings CSUF students together through Marvel Rivals for social gameplay, strategy discussions, and optional student-run events. We welcome all skill levels and aim to build community while helping new players learn the game.", website_key: "csufrivals", categories: ["Special Interest", "Social", "Technology"], tags: ["technology"] },
  { id: 'club-136381', titanlink_id: "136381", name: "American Society of Mechanical Engineers", summary: "ASME is an organization that enables collaboration, knowledge sharing, career enrichment, and skills development across all engineering disciplines. This organization is represented explicitly by California State University Fullerton students.", website_key: "asme", categories: ["Special Interest", "College of Engineering and Computer Science", "Social", "Technology"], tags: ["engineering", "technology"] },
  { id: 'club-133035', titanlink_id: "133035", name: "National Society of Black Engineers; California State University, Fullerton Chapter", summary: "The National Society of Black Engineers is a non-profit student run organization. Our mission is to increase the number of culturally responsible black engineers who excel academically, succeed professionally, and positively impact the community.", website_key: "nsbecsuf", categories: ["Cultural", "College of Engineering and Computer Science"], tags: ["cultural", "engineering"] },
  { id: 'club-135973', titanlink_id: "135973", name: "Society of Hispanic Professional Engineers", summary: "The vision of SHPE at CSUF is a world where our members are highly valued and influential as the leading innovators, scientists, mathematicians and engineers.", website_key: "csufshpe", categories: ["Cultural", "Special Interest", "Career Planning", "College of Engineering and Computer Science", "Social", "Technology"], tags: ["career", "cultural", "engineering", "leadership", "technology"] },
  { id: 'club-138103', titanlink_id: "138103", name: "Fullerton Motor Group", summary: "Fullerton Motor Group is a place for car enthusiasts, advocates, and people with general interests in automotive technologies to discuss, educate, and help others with automotive interests.", website_key: "fullertonmotorgroup", categories: ["Special Interest", "Sport", "Recreation", "Outdoors", "Social", "Technology"], tags: ["outdoors", "recreation", "sport", "technology"] },
  { id: 'club-138169', titanlink_id: "138169", name: "Society of Women Engineers", summary: "We are an organization that supports diversity in engineering and technology, through outreach, volunteering and community service.", website_key: "swe", categories: ["Political/Social Action", "Service", "College of Engineering and Computer Science", "Technology"], tags: ["engineering", "political-social-action", "service", "technology"] },
  { id: 'club-135443', titanlink_id: "135443", name: "Tau Beta Pi California Chi Chapter", summary: "Tau Beta Pi is the only engineering honor society representing the entire engineering profession. It is the nation's second-oldest honor society, founded at Lehigh University in 1885.", website_key: "tbp", categories: ["Honor Society", "College of Engineering and Computer Science", "Sustainability", "Technology"], tags: ["engineering", "sustainability", "technology"] },
  { id: 'club-135857', titanlink_id: "135857", name: "Super Smash Brothers Club", summary: "The Smash Club of CSUF is a club to help grow and bring together the local community of students interested in the Super Smash Bros. franchise and engage in social events that encourage friendly competition and community building.", website_key: "csufsmash", categories: ["Cultural", "Special Interest", "Recreation", "LGBTQ+", "Social", "Technology"], tags: ["cultural", "lgbtq", "recreation", "technology"] },
  { id: 'club-137065', titanlink_id: "137065", name: "Association for Computing Machinery - Women", summary: "ACM-W celebrates & advocates for the full engagement, education, & opportunities of women in all aspects of the computing field. We endeavor to provide a wide range of programs/services to students & advance the contributions of technical women students.", website_key: "acmw", categories: ["College of Engineering and Computer Science", "College of Natural Science and Mathematics"], tags: ["engineering", "software-engineering"] },
  { id: 'club-137052', titanlink_id: "137052", name: "Society of Automotive Engineering - Formula", summary: "SAE is California State University, Fullerton\u2019s Formula Titan Racing team and one of the university\u2019s premier engineering legacy organizations. Members gain hands-on experience in designing, manufacturing, testing, and competing with a Formula SAE car.", website_key: "fsae", categories: ["Special Interest", "Recreation", "College of Engineering and Computer Science", "Technology"], tags: ["business", "engineering", "recreation", "technology"] },
  { id: 'club-135175', titanlink_id: "135175", name: "Institute of Navigation", summary: "The Institute of Navigation is supported by the Electrical Engineering department in advancing the field of GPS and navigational technologies. In addition, this club focuses on engineering competitions that utilize navigation such as autonomous robotics.", website_key: "ion", categories: ["Special Interest", "College of Engineering and Computer Science", "Technology"], tags: ["engineering", "programming", "technology"] },
  { id: 'club-136539', titanlink_id: "136539", name: "Offensive Security Society", summary: "To catch a criminal, you need to think like one. At OSS, we teach you the necessary skills to accomplish this over cyberspace to become an ethical hacker. Learn and network with CSUF Students brought together by Cybersecurity interest!", website_key: "oss", categories: ["Special Interest", "College of Engineering and Computer Science", "Technology"], tags: ["cybersecurity", "engineering", "technology"] },
  { id: 'club-132823', titanlink_id: "132823", name: "Data Science and Machine Learning", summary: "The Data Science and Machine learning club's mission is to create an inclusive environment to network, and foster growth and interest in Technology and its practical uses from data science and machine learning techniques.", website_key: "machine-learning-and-data-science-club", categories: ["Special Interest", "College of Engineering and Computer Science", "College of Business and Economics", "Technology"], tags: ["ai", "business", "data-science", "engineering", "technology"] },
  { id: 'club-297863', titanlink_id: "297863", name: "Society for the Advancement of Material and Process Engineering CSUF Chapter", summary: "The Society for the Advancement of Material and Process Engineering (SAMPE\u00ae) is a global professional member society that provides enhanced educational opportunities, by delivering information on new and advanced materials and processing technology.", website_key: "sampe", categories: ["Special Interest", "College of Engineering and Computer Science", "Technology"], tags: ["engineering", "technology"] },
  { id: 'club-349456', titanlink_id: "349456", name: "United States Institute for Theatre Technology, Inc. Student Chapter at California State University, Fullerton", summary: "The CSU Fullerton USITT Student Chapter was established to provide opportunities for students wishing to further their experience in technical theatre, design, and management through education, outreach, and networking.", website_key: "usittcsuf", categories: ["Special Interest", "College of the Arts", "Technology"], tags: ["technology"] },
  { id: 'club-332118', titanlink_id: "332118", name: "Augmentative & Alternative Communication Club", summary: "Not everyone can communicate through speech. Our mission is to educate others on augmentative and alternative communication (AAC), the form of communication used by those who cannot solely rely on speech for effective communication.", website_key: "aac", categories: ["College of Communications", "College of Education", "College of Health and Human Development", "Health & Wellness", "Technology"], tags: ["health-wellness", "technology"] },
  { id: 'club-136541', titanlink_id: "136541", name: "Titan Rover", summary: "Titan Rover is an interdisciplinary collaboration of students from multiple backgrounds with an interest in extraterrestrial robotic and scientific applications. Our goal is to qualify and compete in the Mars Society's annual University Rover Challenge.", website_key: "titanrover", categories: ["Special Interest", "Career Planning", "College of Engineering and Computer Science", "College of Natural Science and Mathematics", "College of Business and Economics", "Social", "Technology"], tags: ["business", "career", "engineering", "programming", "software-engineering", "technology"] },
  { id: 'club-132967', titanlink_id: "132967", name: "Video Game Development Club", summary: "The Video Game Development Club at CSUF is an organization aimed at aspiring game developers, artists, composers, and any other individuals looking to apply their skills with like-minded students to create interactive applications and games.", website_key: "vgdc", categories: ["Special Interest", "Recreation", "Career Planning", "College of Engineering and Computer Science", "College of the Arts", "LGBTQ+", "Music", "Social"], tags: ["career", "engineering", "game-dev", "lgbtq", "music", "recreation"] },
  { id: 'club-348878', titanlink_id: "348878", name: "ACM SIGGRAPH", summary: "ACM SIGGRAPH is a student chapter focused on fostering a diverse community for students interested in the future of computer graphics, interactive techniques, and emerging technologies associated with ACM SIGGRAPH.", website_key: "csufacmsiggraph", categories: ["Special Interest", "College of Engineering and Computer Science", "College of the Arts", "Technology"], tags: ["engineering", "software-engineering", "technology"] },
  { id: 'club-332185', titanlink_id: "332185", name: "The SIAM Student Chapter at California State University, Fullerton", summary: "The SIAM Student Chapter provides opportunities for students to participate in a national organization, benefit from its resources, foster connections with members of industry, and explore opportunities for pursing careers in applied mathematics.", website_key: "siamstudentchaptercsuf", categories: ["Career Planning", "College of Natural Science and Mathematics"], tags: ["career", "engineering"] },
  { id: 'club-381813', titanlink_id: "381813", name: "Women In Business & STEM", summary: "The Women in Business and STEM club supports student career and personal growth through resume help, webinars with industry experts, leadership roles, study groups, community service, and public speaking training. \r\nWebsite: https://wibscsuf.com", website_key: "womeninbusinessstem", categories: ["Cultural", "Special Interest", "Career Planning", "College of Engineering and Computer Science", "College of Natural Science and Mathematics", "College of Business and Economics", "Social", "Technology"], tags: ["business", "career", "cultural", "engineering", "leadership", "technology"] },
  { id: 'club-132479', titanlink_id: "132479", name: "Titan Racing", summary: "The purpose of this organization is to provide engineering opportunities for students at CSU Fullerton and to build an SAE approved mini baja for competition.", website_key: "titanracing", categories: ["Special Interest", "Career Planning", "College of Engineering and Computer Science", "Technology"], tags: ["career", "engineering", "technology"] },
  { id: 'club-137313', titanlink_id: "137313", name: "Association for Computing Machinery", summary: "We are the largest Computer Science community at CSUF. Our chapter provides workshops, career resources, and a social community that's open to all majors.\r\n\r\nJoin us on Discord at acmcsuf.com/discord", website_key: "acm", categories: ["Career Planning", "College of Engineering and Computer Science", "Social", "Technology"], tags: ["career", "engineering", "software-engineering", "technology"] },
  { id: 'club-181143', titanlink_id: "181143", name: "Theta Tau", summary: "Theta Tau is a professional co-ed Engineering Fraternity for all type of engineers and computer science. Its main goal is to develop and maintain a high standard of professional interest among its members and to unite them in a strong bond of fellowship.", website_key: "thetatau", categories: ["Fraternity & Sorority", "Service", "Career Planning", "College of Engineering and Computer Science"], tags: ["career", "engineering", "service"] },
  { id: 'club-365843', titanlink_id: "365843", name: "Backcountry Hunters and Anglers Chapter at Cal State University, Fullerton", summary: "BHA is an organization of sportsmen and women dedicated to work on behalf of public lands and waters. They achieve this through their focus on three areas: access & opportunity, public lands and waters, and fair chase.", website_key: "backcountry-hunters-anglers-csuf", categories: ["Political/Social Action", "Service", "Special Interest", "Sport", "Recreation", "Health & Wellness", "Outdoors", "Social", "Sustainability"], tags: ["health-wellness", "outdoors", "political-social-action", "recreation", "service", "sport", "sustainability"] },
  { id: 'club-136279', titanlink_id: "136279", name: "Dance Association", summary: "Dance Association provides a greater opportunity for members to become involved in the Dance and Theater Department, along with the campus community.", website_key: "danceassociationcsuf", categories: ["Special Interest", "Sport", "Recreation", "Career Planning", "College of the Arts", "Dance", "Health & Wellness", "Social"], tags: ["career", "dance", "health-wellness", "leadership", "mentorship", "recreation", "sport"] },
  { id: 'club-295451', titanlink_id: "295451", name: "Ascend Leadership at CSUF", summary: "Empowering the Next Generation of AAPI Business Leaders at CSUF", website_key: "ascendcsuf", categories: ["Cultural", "Career Planning", "College of Business and Economics"], tags: ["business", "career", "cultural", "leadership", "mentorship"] },
  { id: 'club-132624', titanlink_id: "132624", name: "The Teaching English to Speakers of Other Languages Club of California State University, Fullerton", summary: "Providing resources and opportunities on how to teach English to speakers of other languages. A place to network and exchange ideas; we focus on developing professional knowledge of language teaching and expanding intercultural inclusion and awareness.", website_key: "tesol", categories: ["Cultural", "Political/Social Action", "Service", "Special Interest", "Recreation", "Career Planning", "College of Humanities & Social Sciences", "Social"], tags: ["career", "cultural", "political-social-action", "recreation", "service"] },
  { id: 'club-430903', titanlink_id: "430903", name: "Psychology Student Support Club", summary: "The Psychology Student Support Club (PSSC) is always on standby and ready to assist all California State University, Fullerton students to facilitate a safe space for unity and an opportunity for all.", website_key: "psychologystudentsupportclub", categories: ["Cultural", "Career Planning", "College of Humanities & Social Sciences", "Health & Wellness", "LGBTQ+", "Social", "Sustainability"], tags: ["career", "cultural", "health-wellness", "lgbtq", "sustainability"] },
  { id: 'club-433268', titanlink_id: "433268", name: "Latinas Leading in Advocacy & Defense", summary: "Empowering Latina women in criminal justice by creating a space where they feel seen, supported, and represented. We promote education, confidence, and career success while helping members overcome cultural and educational barriers.", website_key: "latinasleadcsuf", categories: ["Cultural", "Career Planning", "College of Education", "College of Humanities & Social Sciences", "Health & Wellness", "Social"], tags: ["career", "cultural", "health-wellness", "leadership", "mentorship"] },
  { id: 'club-132736', titanlink_id: "132736", name: "Latino Business Student Association", summary: "We, the Latino Business Student Association (LBSA), are more than a club, we are a familia. Our organization revolves around professional development, networking, and community service. Our goal is to help our members become community leaders.", website_key: "lbsa", categories: ["Cultural", "Service", "Career Planning", "College of Business and Economics", "Social"], tags: ["business", "career", "cultural", "leadership", "service"] },
  { id: 'club-429512', titanlink_id: "429512", name: "Global Medical Brigades at CSUF", summary: "Global Medical Brigades at CSUF raises funds to support annual medical mission trips, allowing students to volunteer in underserved communities, shadow local physicians, assist with pharmacy operations, and lead health education workshops globally.", website_key: "gmbcsuf", categories: ["Political/Social Action", "Special Interest", "Career Planning", "College of Health and Human Development", "College of Humanities & Social Sciences", "College of Natural Science and Mathematics", "Health & Wellness", "Social", "Sustainability"], tags: ["career", "health-wellness", "political-social-action", "sustainability"] },
  { id: 'club-424638', titanlink_id: "424638", name: "Live Action at California State University, Fullerton", summary: "Live Action at CSUF is a chapter of the national,\u00a0non-profit organization founded in 2003 by Lila Rose. We are dedicated to building a culture of life on campus and beyond through community service, outreach, and social efforts.", website_key: "csuf-liveaction", categories: ["Political/Social Action", "Faith", "Service", "Special Interest", "Health & Wellness"], tags: ["faith", "health-wellness", "political-social-action", "service"] },
  { id: 'club-203288', titanlink_id: "203288", name: "Society for the Advancement of Chicanos/Hispanics and Native Americans in Science at California State University, Fullerton", summary: "SACNAS is a national society that fosters the success of persons from groups historically under-represented in science and seeks to improve and expand opportunities for students in the scientific workforce and academia.", website_key: "sacnascsuf", categories: ["Cultural", "Service", "Special Interest", "College of Natural Science and Mathematics", "Social"], tags: ["career", "cultural", "leadership", "service"] },
  { id: 'club-134512', titanlink_id: "134512", name: "Master of Social Work Association", summary: "MSWA aims to empower MSW students through community, peer support, and professional development.", website_key: "mswacsuf", categories: ["Political/Social Action", "Service", "Special Interest", "College of Health and Human Development", "Health & Wellness", "Social"], tags: ["career", "health-wellness", "political-social-action", "service"] },
  { id: 'club-134772', titanlink_id: "134772", name: "Kinesiology Student Association", summary: "The Kinesiology Student Association (KSA) works to provide support and guidance to create a comfortable environment for students to exchange ideas, skills, and knowledge regarding all aspects of the field of Kinesiology.", website_key: "ksa", categories: ["Sport", "College of Health and Human Development", "Health & Wellness", "Outdoors", "Social"], tags: ["career", "health-wellness", "outdoors", "sport"] },
  { id: 'club-135038', titanlink_id: "135038", name: "Geography Club of CSUF", summary: "The Geography Club of CSUF is an organization of students who share interests in humanity's relations with the natural world, our built environment and cultures. As a club we facilitate activities exploring our natural, urban and cultural landscapes.", website_key: "geographyclubofcsuf", categories: ["Special Interest", "Recreation", "College of Humanities & Social Sciences", "Outdoors", "Social", "Sustainability"], tags: ["career", "outdoors", "recreation", "sustainability"] },
  { id: 'club-226015', titanlink_id: "226015", name: "Planned Parenthood Generation Action at CSUF", summary: "Our club is committed to educating and advocating issues of reproductive rights and freedoms, while prioritizing inclusivity and political action.", website_key: "csufppgen", categories: ["Political/Social Action", "Service", "Health & Wellness", "LGBTQ+"], tags: ["health-wellness", "lgbtq", "political-social-action", "service"] },
  { id: 'club-135401', titanlink_id: "135401", name: "Flying Samaritans", summary: "Flying Samaritans at CSUF is a sub-chapter of the larger Palomar Chapter of the Flying Samaritans organization that intends to aid in the provision of free medical and vision care to the citizens of Mexico who lack health care.", website_key: "flyingsams", categories: ["Service", "Special Interest", "Career Planning", "College of Health and Human Development", "College of Natural Science and Mathematics", "Health & Wellness", "Social", "Sustainability"], tags: ["career", "health-wellness", "service", "sustainability"] },
  { id: 'club-135737', titanlink_id: "135737", name: "College Republicans at California State University Fullerton", summary: "A strong community of open dialogue, leadership, and conservative values. \r\nMeetings : Tuesday at 5:30 pm \r\n - Internships, volunteering, public speaking , and networking \r\nIG : @csufrepublicans \r\nE-mail : titan.csufrepublicans@gmail.com", website_key: "csufrepublicans", categories: ["Political/Social Action", "Service", "Special Interest", "Career Planning", "Social"], tags: ["career", "leadership", "political-social-action", "service"] },
  { id: 'club-135468', titanlink_id: "135468", name: "French Club", summary: "The purpose of this organization is to promote learning, community, and improved understanding and performance of: French language, French culture, and the CSUF French program(s).", website_key: "frenchclub", categories: ["Political/Social Action", "Special Interest", "Recreation", "Career Planning", "College of Communications", "College of Humanities & Social Sciences", "Music"], tags: ["career", "music", "political-social-action", "recreation"] },
  { id: 'club-132783', titanlink_id: "132783", name: "Student Veterans of America", summary: "The purpose of this organization is to cultivate a sense of belonging among student veterans in higher education to foster success on and off campus.", website_key: "studentveteransassociation", categories: ["Service", "Special Interest", "Recreation", "Career Planning", "College of Humanities & Social Sciences", "Outdoors", "Social"], tags: ["career", "outdoors", "recreation", "service"] },
  { id: 'club-137490', titanlink_id: "137490", name: "CSUF Surf Club", summary: "The main focus of this club is to bring the surfers, bodyboarders and bodysurfers from CSUF together. We will have planned surf meets and events. Our goal is to not only have people enjoy the ocean but also respect it as well.", website_key: "csufsurfclub", categories: ["Special Interest", "Sport", "Recreation", "Health & Wellness", "Outdoors", "Social"], tags: ["health-wellness", "outdoors", "recreation", "sport"] },
  { id: 'club-135859', titanlink_id: "135859", name: "Glass Club of CSUF", summary: "The Glass and Metal Club of CSUF promotes education of awareness of glass art by sponsoring guest lectures and demonstrations by qualified glass artists and historians. The club also disseminates information promotion.", website_key: "glassclubofcsuf", categories: ["Cultural", "Special Interest", "Recreation", "Career Planning", "College of Education", "College of the Arts"], tags: ["career", "cultural", "mentorship", "recreation"] },
  { id: 'club-132719', titanlink_id: "132719", name: "Behind The Scenes", summary: "BTS provides students in the Entertainment & Hospitality Management program with opportunities to interact with fellow students, professors, as well as with members of the Entertainment and Hospitality industries through VIP tours, panels, workshops.", website_key: "behindthescenes", categories: ["Service", "Special Interest", "Sport", "College of Business and Economics", "Music", "Social"], tags: ["business", "leadership", "music", "service", "sport"] },
  { id: 'club-413299', titanlink_id: "413299", name: "Phi Delta Theta", summary: "Phi Delta Theta Alpha Alpha promotes leadership, academic excellence, and community service among its members. Our fraternity emphasizes lifelong brotherhood and personal development.", website_key: "phidelt", categories: ["Fraternity & Sorority", "Service", "Sport", "Career Planning", "Social"], tags: ["career", "leadership", "service", "sport"] },
  { id: 'club-134511', titanlink_id: "134511", name: "Hermanas Unidas", summary: "Hermanas Unidas de CSUF was established in December 2003. We are a nonprofit organization that enocurages latinas within higher education to build community, leadership, and thrive in academics together.", website_key: "hermanasunidas", categories: ["Cultural", "Service", "Social"], tags: ["cultural", "leadership", "service"] },
  { id: 'club-429952', titanlink_id: "429952", name: "Nurses for Sexual and Reproductive Health", summary: "NSRH provides students with the education, tools, and resources necessary to become social-change agents within the healthcare system as it relates to sexual and reproductive justice.", website_key: "nsrh", categories: ["Political/Social Action", "College of Health and Human Development", "Health & Wellness", "LGBTQ+"], tags: ["health-wellness", "lgbtq", "political-social-action"] },
  { id: 'club-415278', titanlink_id: "415278", name: "Gensei Ryu USA Karate", summary: "We are a non-profit karate organization. We have dedicated our time to being there for the community by providing low cost classes and teaching martial arts to whoever is interested. We are extending our organization to do the same and more at CSUF.", website_key: "gensei_ryu_usa_karate", categories: ["Special Interest", "Sport", "Recreation", "Health & Wellness", "Social"], tags: ["health-wellness", "recreation", "sport"] },
  { id: 'club-349722', titanlink_id: "349722", name: "Turning Point USA at California State University, Fullerton", summary: "Turning Point USA is a 501(c)3 non-profit organization. The organization\u2019s mission is to identify, educate, train, and organize students to promote the principles of freedom, free markets, and limited government.", website_key: "turning_point_usa_csuf", categories: ["Cultural", "Political/Social Action", "Service", "Special Interest", "Social"], tags: ["cultural", "political-social-action", "service"] },
  { id: 'club-331331', titanlink_id: "331331", name: "Delta Epsilon Mu - Beta Alpha Chapter", summary: "Delta Epsilon Mu is the nation's premier Professional Pre-Health Co-Ed Fraternity. Our organization works with pre-health students across medicine, dentistry, nursing, psychology, physical therapy, veterinary, and allied health studies.", website_key: "dembetaalpha", categories: ["Fraternity & Sorority", "Service", "Career Planning", "College of Health and Human Development", "College of Humanities & Social Sciences", "College of Natural Science and Mathematics", "Health & Wellness", "Social"], tags: ["career", "health-wellness", "service"] },
  { id: 'club-134719', titanlink_id: "134719", name: "TitanTHON: A Miracle Network Dance Marathon", summary: "TitanTHON is one of 400+ Miracle Network Dance Marathons across the United States and Canada! By raising funds for our local CHOC Children's hospital, we are equipped to change kids' health. Kids can't wait so neither should you.", website_key: "titanthon", categories: ["Service", "Special Interest", "Recreation", "College of Health and Human Development", "Social"], tags: ["leadership", "recreation", "service"] },
  { id: 'club-332203', titanlink_id: "332203", name: "Nursing Peer Tutoring", summary: "The purpose of this organization is to advance academic success in nursing courses through proven active learning strategies, peer-to-peer collaboration, and leadership development.", website_key: "nursingpeertutoring", categories: ["Service", "College of Health and Human Development", "Health & Wellness"], tags: ["health-wellness", "leadership", "service"] },
  { id: 'club-383119', titanlink_id: "383119", name: "Ski and Snowboard Club", summary: "Welcome to the CSUF Snowboard and Ski Club! Whether you're a seasoned rider or a first-timer, our inclusive club offers unforgettable experiences on and off the slopes. Join us for regular trips, skill-building, and a vibrant social scene", website_key: "skisnowclub", categories: ["Sport", "Recreation", "Outdoors", "Social"], tags: ["outdoors", "recreation", "sport"] },
]

// Events are dated relative to today, the same as db/seed_events.sql, so they
// never go stale. Times are campus local.
function buildEvents(): CampusEvent[] {
  // Host club, title, day offset, time, building, tags. These have to stay in
  // step with db/seed_events.sql, including the tags, because the scorer
  // divides shared tags by the event's own tag count and a short list here
  // would score higher than the same event out of the database.
  const defs: [string, string, number, string, string, string[]][] = [
    ["Association for Computing Machinery", "Resume Workshop with Industry Mentors", 0, "16:00", 'b-cs', ["career", "software-engineering"]],
    ["Data Science and Machine Learning", "Intro to Neural Networks", 0, "18:00", 'b-e', ["ai", "data-science", "python"]],
    ["Association for Computing Machinery", "Algorithms Practice Session", 1, "12:00", 'b-cs', ["algorithms", "software-engineering"]],
    ["Offensive Security Society", "Beginner Capture the Flag Night", 1, "17:30", 'b-cs', ["ctf", "cybersecurity"]],
    ["Video Game Development Club", "Unity Basics Workshop", 2, "15:00", 'b-va', ["game-dev", "programming"]],
    ["Society of Women Engineers", "Mock Interview Evening", 2, "17:00", 'b-e', ["career", "engineering", "mentorship"]],
    ["Data Science and Machine Learning", "Kaggle Kickoff", 3, "13:00", 'b-pl', ["data-science", "python"]],
    ["Business and Data Analytics Club", "Pitch Night", 3, "18:30", 'b-sgmh', ["business", "leadership", "startups"]],
    ["Association for Computing Machinery", "Git and GitHub for Beginners", 4, "14:00", 'b-cs', ["career", "software-engineering"]],
    ["Ski and Snowboard Club", "Trail Hike Planning", 5, "11:00", 'b-tsu', ["outdoors", "social"]],
    ["Behind The Scenes", "Open Mic Night", 6, "19:00", 'b-tsu', ["arts", "music", "social"]],
    ["Offensive Security Society", "Password Cracking Demo", 8, "16:30", 'b-e', ["cybersecurity", "networking"]],
  ]
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return defs.map(([hostName, title, dayOffset, at, buildingId, tags], i) => {
    const [h, m] = at.split(':').map(Number)
    const start = new Date(today)
    start.setDate(start.getDate() + dayOffset)
    start.setHours(h, m, 0, 0)
    const end = new Date(start.getTime() + 90 * 60 * 1000)
    // the seed joins the host by name, so look it up the same way rather than
    // taking whichever club happens to sit at this position in the array
    const host = clubs.find((c) => c.name === hostName)
    return {
      id: `event-${i}`,
      club_id: host?.id ?? '',
      club_name: host?.name ?? hostName,
      title, starts_at: start.toISOString(), ends_at: end.toISOString(),
      building_id: buildingId, tags,
    }
  })
}
const events = buildEvents()

const profile: Profile = {
  id: 'demo-profile', full_name: 'Demo Titan', major: 'Computer Science',
  interests: ['software-engineering', 'ai', 'algorithms', 'music'],
  career_goals: ['career', 'software-engineering', 'data-science'],
  permit_type: 'student', noise_pref: 2,
}

const classMeetings: ClassMeeting[] = [
  { id: 'cm-0', profile_id: 'demo-profile', course_code: "CPSC 335", day_of_week: 1, start_time: "09:00:00", end_time: "10:15:00", building_id: 'b-cs' },
  { id: 'cm-1', profile_id: 'demo-profile', course_code: "CPSC 362", day_of_week: 1, start_time: "11:30:00", end_time: "12:45:00", building_id: 'b-cs' },
  { id: 'cm-2', profile_id: 'demo-profile', course_code: "MATH 338", day_of_week: 1, start_time: "14:00:00", end_time: "15:15:00", building_id: 'b-mh' },
  { id: 'cm-3', profile_id: 'demo-profile', course_code: "ENGL 301", day_of_week: 1, start_time: "16:30:00", end_time: "17:45:00", building_id: 'b-h' },
  { id: 'cm-4', profile_id: 'demo-profile', course_code: "CPSC 335", day_of_week: 3, start_time: "09:00:00", end_time: "10:15:00", building_id: 'b-cs' },
  { id: 'cm-5', profile_id: 'demo-profile', course_code: "CPSC 362", day_of_week: 3, start_time: "11:30:00", end_time: "12:45:00", building_id: 'b-cs' },
  { id: 'cm-6', profile_id: 'demo-profile', course_code: "MATH 338", day_of_week: 3, start_time: "14:00:00", end_time: "15:15:00", building_id: 'b-mh' },
  { id: 'cm-7', profile_id: 'demo-profile', course_code: "ENGL 301", day_of_week: 3, start_time: "16:30:00", end_time: "17:45:00", building_id: 'b-h' },
  { id: 'cm-8', profile_id: 'demo-profile', course_code: "CPSC 335", day_of_week: 5, start_time: "09:00:00", end_time: "10:15:00", building_id: 'b-cs' },
  { id: 'cm-9', profile_id: 'demo-profile', course_code: "CPSC 362", day_of_week: 5, start_time: "11:30:00", end_time: "12:45:00", building_id: 'b-cs' },
  { id: 'cm-10', profile_id: 'demo-profile', course_code: "CPSC 349", day_of_week: 2, start_time: "08:00:00", end_time: "09:15:00", building_id: 'b-e' },
  { id: 'cm-11', profile_id: 'demo-profile', course_code: "PHYS 225", day_of_week: 2, start_time: "10:30:00", end_time: "11:45:00", building_id: 'b-mh' },
  { id: 'cm-12', profile_id: 'demo-profile', course_code: "CPSC 351", day_of_week: 2, start_time: "13:00:00", end_time: "14:15:00", building_id: 'b-cs' },
  { id: 'cm-13', profile_id: 'demo-profile', course_code: "HIST 110", day_of_week: 2, start_time: "15:30:00", end_time: "16:45:00", building_id: 'b-lh' },
  { id: 'cm-14', profile_id: 'demo-profile', course_code: "CPSC 349", day_of_week: 4, start_time: "08:00:00", end_time: "09:15:00", building_id: 'b-e' },
  { id: 'cm-15', profile_id: 'demo-profile', course_code: "PHYS 225", day_of_week: 4, start_time: "10:30:00", end_time: "11:45:00", building_id: 'b-mh' },
  { id: 'cm-18', profile_id: 'demo-profile', course_code: "CPSC 349", day_of_week: 2, start_time: "18:00:00", end_time: "19:15:00", building_id: 'b-e' },
  { id: 'cm-19', profile_id: 'demo-profile', course_code: "CPSC 349", day_of_week: 4, start_time: "18:00:00", end_time: "19:15:00", building_id: 'b-e' },
  { id: 'cm-16', profile_id: 'demo-profile', course_code: "CPSC 351", day_of_week: 4, start_time: "13:00:00", end_time: "14:15:00", building_id: 'b-cs' },
  { id: 'cm-17', profile_id: 'demo-profile', course_code: "HIST 110", day_of_week: 4, start_time: "15:30:00", end_time: "16:45:00", building_id: 'b-lh' },
]

// Async on purpose. These become Supabase queries later and the callers
// already handle loading and errors, so nothing outside this file changes.
export async function getBuildings(): Promise<Building[]> { return buildings }
export async function getProfile(): Promise<Profile> { return profile }
export async function getClassMeetings(): Promise<ClassMeeting[]> { return classMeetings }
export async function getParkingLots(): Promise<ParkingLot[]> { return parkingLots }
export async function getSpots(): Promise<Spot[]> { return spots }
export async function getClubs(): Promise<Club[]> { return clubs }
export async function getEvents(): Promise<CampusEvent[]> { return events }

// Only the rows for the arrival hour and the hours either side of it, which is
// what the Supabase query will filter on too.
export async function getAvailabilityAround(day: number, hour: number): Promise<LotAvailability[]> {
  return lotAvailability.filter(
    (r) => r.day_of_week === day && Math.abs(r.hour - hour) <= 1,
  )
}
