import math

EARTH_RADIUS_M = 6371000
DETOUR_FACTOR = 1.3
WALK_METRES_PER_MINUTE = 80


def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def walk_minutes(metres: float) -> int:
    return math.ceil(metres * DETOUR_FACTOR / WALK_METRES_PER_MINUTE)
