/**
 * Seed 3 demo agents + 30 properties into MongoDB.
 * Emails: agent1@gmail.com … agent3@gmail.com
 * Password: Agent@123
 */
require("dotenv").config();
const { MongoClient, ObjectId } = require("mongodb");

const API = process.env.BETTER_AUTH_URL || "http://localhost:4000";
const PASSWORD = "Agent@123";

const AGENTS = [
  { name: "Nusrat Jahan", email: "agent1@gmail.com", specialty: "Residential sales" },
  { name: "Rafiul Hasan", email: "agent2@gmail.com", specialty: "Luxury & rentals" },
  { name: "Mehnaz Chowdhury", email: "agent3@gmail.com", specialty: "Commercial & investment" },
];

const TYPES = ["apartment", "house", "villa", "land", "commercial", "studio"];
const PURPOSES = ["sale", "rent"];
const AREAS = [
  { area: "Uttara", address: "Sector 7, Road 12" },
  { area: "Gulshan", address: "Road 45, Gulshan 2" },
  { area: "Dhanmondi", address: "Road 27, Dhanmondi" },
  { area: "Bashundhara", address: "Block C, Road 5" },
  { area: "Mirpur", address: "Mirpur 10, Block A" },
  { area: "Banani", address: "Road 11, Banani" },
];

const IMAGES = [
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800",
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800",
  "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800",
  "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800",
];

const AMENITIES = [
  ["Parking", "Generator", "Security"],
  ["Lift", "CCTV", "Gas"],
  ["Gym", "Pool", "Parking"],
  ["Rooftop", "Generator"],
  ["Furnished", "AC", "WiFi"],
  ["Corner plot", "Wide road"],
];

async function ensureAgent(agent) {
  const headers = {
    "Content-Type": "application/json",
    Origin: "http://localhost:3000",
  };

  const signupRes = await fetch(`${API}/api/auth/sign-up/email`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: agent.name,
      email: agent.email,
      password: PASSWORD,
    }),
  });

  if (signupRes.ok) {
    const data = await signupRes.json();
    return data.user.id;
  }

  const text = await signupRes.text();
  const signInRes = await fetch(`${API}/api/auth/sign-in/email`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: agent.email,
      password: PASSWORD,
    }),
  });

  if (!signInRes.ok) {
    throw new Error(
      `Could not create/login ${agent.email}: signup=${text} signin=${await signInRes.text()}`,
    );
  }

  const data = await signInRes.json();
  return data.user.id;
}

function buildProperty(index, agentId) {
  const type = TYPES[index % TYPES.length];
  const purpose = PURPOSES[index % 2 === 0 ? 0 : 1];
  // Commercial bias for agent3's share, but keep variety for all
  const loc = AREAS[index % AREAS.length];
  const beds = type === "land" || type === "commercial" ? 0 : (index % 4) + 1;
  const baths = type === "land" ? 0 : Math.max(1, beds - 1);
  const salePrice = [4500000, 7800000, 12500000, 18500000, 25000000, 42000000][index % 6];
  const rentPrice = [25000, 35000, 45000, 65000, 85000, 120000][index % 6];
  const price = purpose === "rent" ? rentPrice : type === "land" ? salePrice * 1.2 : salePrice;
  const now = new Date();

  return {
    title: `${loc.area} ${type.charAt(0).toUpperCase() + type.slice(1)} ${index + 1}`,
    description: `${purpose === "rent" ? "For rent" : "For sale"}: modern ${type} in ${loc.area}. ${AGENTS[index % 3].specialty}. Verified listing with parking and easy visit booking.`,
    type,
    status: "available",
    purpose,
    price: Math.round(price),
    currency: "BDT",
    bedrooms: beds,
    bathrooms: baths,
    areaSqFt: type === "land" ? 2000 + index * 50 : 650 + index * 40,
    location: {
      address: loc.address,
      city: "Dhaka",
      area: loc.area,
      country: "Bangladesh",
    },
    images: [IMAGES[index % IMAGES.length], IMAGES[(index + 1) % IMAGES.length]],
    amenities: AMENITIES[index % AMENITIES.length],
    listedBy: ObjectId.isValid(agentId) ? new ObjectId(agentId) : agentId,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

(async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  const agentIds = [];
  for (const agent of AGENTS) {
    const id = await ensureAgent(agent);
    agentIds.push(id);
    await db.collection("user").updateOne(
      { _id: ObjectId.isValid(id) ? new ObjectId(id) : id },
      { $set: { role: "agent", updatedAt: new Date() } },
    );
    console.log(`Agent ready: ${agent.email} (${id}) role=agent`);
  }

  // Remove previous demo seed properties (keep Gulshan if wanted — wipe all for clean 30)
  // Only delete ones titled like our seed pattern OR tagged — safer: delete all available demo titles
  const deleteResult = await db.collection("properties").deleteMany({
    title: { $regex: /^(Uttara|Gulshan|Dhanmondi|Bashundhara|Mirpur|Banani) /i },
  });
  console.log(`Cleared previous area-titled listings: ${deleteResult.deletedCount}`);

  const docs = [];
  for (let i = 0; i < 30; i += 1) {
    const agentId = agentIds[i % 3];
    docs.push(buildProperty(i, agentId));
  }

  const insert = await db.collection("properties").insertMany(docs);
  const byPurpose = await db
    .collection("properties")
    .aggregate([
      { $match: { isActive: true, status: "available" } },
      { $group: { _id: { purpose: "$purpose", type: "$type" }, n: { $sum: 1 } } },
      { $sort: { "_id.type": 1, "_id.purpose": 1 } },
    ])
    .toArray();

  console.log(
    JSON.stringify(
      {
        inserted: Object.keys(insert.insertedIds).length,
        agents: AGENTS.map((a, i) => ({ email: a.email, password: PASSWORD, id: agentIds[i] })),
        breakdown: byPurpose,
        totalAvailable: await db.collection("properties").countDocuments({
          isActive: true,
          status: "available",
        }),
      },
      null,
      2,
    ),
  );

  await client.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
