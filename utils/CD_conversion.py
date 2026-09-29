import geopandas as gpd
import pandas as pd
import numpy as np
from shapely import wkt
from shapely.geometry import Point, LineString
import matplotlib.pyplot as plt
import os
import json
import requests
import warnings
from shapely.errors import ShapelyDeprecationWarning

# Borough ID mapping
BOROUGH_IDS = {
    'MANHATTAN': 1,
    'BRONX': 2,
    'BROOKLYN': 3,
    'QUEENS': 4,
    'STATEN ISLAND': 5
}

def get_borough_id(borough_name):
    """
    Get borough ID from borough name.
    
    Parameters:
    -----------
    borough_name : str
        Borough name string
        
    Returns:
    --------
    int or None
        Borough ID (1-5), or None if not found
    """
    if pd.isna(borough_name):
        return None
    
    borough_upper = str(borough_name).strip().upper()
    return BOROUGH_IDS.get(borough_upper)


def extract_borough_from_cd(cd):
    """
    Extract borough ID from community district code.
    
    Parameters:
    -----------
    cd : int
        Community district code (e.g., 101, 205)
        
    Returns:
    --------
    int
        Borough ID (1-5)
    """
    return int(cd) // 100


def download_cd_geodata(cache_file='data/NYC_DCP_GeoJSON.geojson'):
    """
    Download NYC Community Districts GeoJSON data from NYC OpenData API.

    Source: https://www.nyc.gov/content/planning/pages/resources/datasets/community-districts

    Parameters:
    -----------
    None

    Returns:
    --------
    geopandas.GeoDataFrame
        Community district boundaries in EPSG:2263 coordinate system with exploded geometries

    Notes:
    ------
    Uses "Water Included" version to avoid gaps in shoreline coverage that could result in 
    unassigned community districts. Caches results locally, converts to EPSG:2263, validates 
    geometries, and explodes MultiPolygons to Polygons.

    Available datasets:
    1. Community Districts (Clipped to Shoreline)
    https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/NYC_Community_Districts/FeatureServer/0/query?where=1=1&outFields=*&outSR=4326&f=pgeojson

    2. Community Districts (Water Included) - USED
    https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/NYC_Community_Districts_Water_Included/FeatureServer/0/query?where=1=1&outFields=*&outSR=4326&f=pgeojson
    """

    if os.path.exists(cache_file):
        print(f"Loading cached community district data from {cache_file}...")
        try:
            cd_gdf = gpd.read_file(cache_file)
        except Exception as e:
            print(f"Error reading cache file {cache_file}: {e}. Attempting re-download.")
            os.remove(cache_file)
            return download_cd_geodata(cache_file)
    else:
        print("Downloading NYC Community Districts GeoJSON from API...")
        url = "https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/NYC_Community_Districts_Water_Included/FeatureServer/0/query?where=1=1&outFields=*&outSR=4326&f=pgeojson"
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            geojson_data = response.json()
        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to download data: {e}")
        except json.JSONDecodeError:
             raise Exception(f"Failed to decode JSON from API response.")

        with open(cache_file, 'w') as f:
            json.dump(geojson_data, f)
        cd_gdf = gpd.read_file(cache_file)
        print(f"Downloaded and cached {len(cd_gdf)} community districts features")

    target_crs = 'EPSG:2263'
    if str(cd_gdf.crs).upper() != target_crs:
        print(f"Converting boundaries from {cd_gdf.crs} to {target_crs} (NY Long Island State Plane)...")
        try:
            cd_gdf = cd_gdf.to_crs(target_crs)
        except Exception as e:
            raise Exception(f"CRS conversion failed: {e}. Check if pyproj is installed correctly.")
    else:
         print(f"Boundaries already in target CRS: {target_crs}")

    # Validation and Cleaning 
    cd_gdf['geometry'] = cd_gdf.geometry.buffer(0)
    initial_geom_count = len(cd_gdf)
    cd_gdf = cd_gdf[~cd_gdf.is_empty]
    cd_gdf = cd_gdf[cd_gdf.is_valid]
    cleaned_geom_count = len(cd_gdf)
    if cleaned_geom_count < initial_geom_count:
        print(f"Removed {initial_geom_count - cleaned_geom_count} invalid/empty geometries from CD data.")
    if cd_gdf.empty:
        raise Exception("All community district geometries became invalid after buffering.")
    if 'BoroCD' not in cd_gdf.columns:
         raise ValueError("'BoroCD' column not found in GeoDataFrame. Check GeoJSON source.")
    try:
        cd_gdf['BoroCD'] = pd.to_numeric(cd_gdf['BoroCD'], errors='coerce')
        cd_gdf.dropna(subset=['BoroCD'], inplace=True)
        cd_gdf['BoroCD'] = cd_gdf['BoroCD'].astype(int)
    except Exception as e:
        print(f"Warning: Could not reliably convert 'BoroCD' to integer: {e}")


    # Explode MultiPolygons into individual Polygons to simplify intersection logic and CD assignment
    original_feature_count = len(cd_gdf)
    contains_multi = any(cd_gdf.geometry.type == 'MultiPolygon')
    if contains_multi:
        cd_gdf_exploded = cd_gdf.explode(index_parts=False).reset_index(drop=True)
        cd_gdf_exploded['geometry'] = cd_gdf_exploded.geometry.buffer(0)
        cd_gdf_exploded = cd_gdf_exploded[cd_gdf_exploded.geometry.type == 'Polygon']
        cd_gdf_exploded = cd_gdf_exploded[~cd_gdf_exploded.is_empty].reset_index(drop=True)
        print(f"Original CD features: {original_feature_count}, Exploded to: {len(cd_gdf_exploded)} simple Polygons")
        if cd_gdf_exploded.empty:
            raise Exception("All community district geometries invalid after exploding/buffering.")
        cd_gdf_exploded['BoroCD'] = cd_gdf_exploded['BoroCD'].astype(int)
        return cd_gdf_exploded
    else:
        print("No MultiPolygons found to explode.")
        cd_gdf = cd_gdf[cd_gdf.geometry.type == 'Polygon'].reset_index(drop=True)
        cd_gdf['BoroCD'] = cd_gdf['BoroCD'].astype(int)
        return cd_gdf
    

def extract_geometry_info(wkt_string):
    """
    Extract geometry and basic info from WKT string.

    Parameters:
    -----------
    wkt_string : str
        WKT format geometry string (must be in EPSG:2263)
        
    Returns:
    --------
    tuple
        (geometry object, geometry type string, num_points)
    """
    if pd.isna(wkt_string):
        return None, None, 0
    
    try:
        geom = wkt.loads(wkt_string)
        
        # Count points
        if geom.geom_type == 'Point':
            num_points = 1
        elif geom.geom_type == 'LineString':
            num_points = len(geom.coords)
        elif geom.geom_type == 'MultiPoint':
            num_points = len(geom.geoms)
        elif geom.geom_type == 'MultiLineString':
            num_points = sum(len(line.coords) for line in geom.geoms)
        elif geom.geom_type == 'Polygon':
            num_points = len(geom.exterior.coords)
        elif geom.geom_type == 'MultiPolygon':
            num_points = sum(len(poly.exterior.coords) for poly in geom.geoms)
        else:
            num_points = 0
            
        return geom, geom.geom_type, num_points
    except:
        return None, None, 0


def calculate_distance(geom):
    """
    Calculate total distance/perimeter for a geometry to estimate construction footage.

    Parameters:
    -----------
    geom : shapely.geometry
        Shapely geometry object
        
    Returns:
    --------
    float
        Total distance in feet
    """
    if geom is None:
        return None
    
    try:
        if geom.geom_type == 'Point':
            return 0.0
        elif geom.geom_type == 'LineString':
            return geom.length
        elif geom.geom_type == 'MultiLineString':
            return sum(line.length for line in geom.geoms)
        elif geom.geom_type == 'MultiPoint':
            return 0.0
        elif geom.geom_type == 'Polygon':
            return geom.length  # Perimeter
        elif geom.geom_type == 'MultiPolygon':
            return sum(poly.length for poly in geom.geoms)
    except:
        return None
    
    return None


def find_cd_by_intersection_length(geom, cd_gdf, use_nearest_fallback=True, max_distance=500, 
                                   debug_index=None, borough_id=None):
    
    """
    Find community district for each construction geometry using geometric intersection length.

    Uses spatial index for efficient querying and suppresses Shapely RuntimeWarnings during 
    intersection. Includes borough-aware prioritization for boundary cases.

    Parameters:
    -----------
    geom : shapely.geometry
        Shapely geometry object (in EPSG:2263)
    cd_gdf : geopandas.GeoDataFrame
        GeoDataFrame with exploded community district boundaries (in EPSG:2263)
    use_nearest_fallback : bool
        If True, use nearest CD for points outside boundaries
    max_distance : float
        Maximum distance in feet to search for nearest CD
    debug_index : int, optional
        DataFrame index for debug logging (internal use)
    borough_id : int
        Borough ID (1-5) to prioritize CDs from that borough

    Returns:
    --------
    str or None
        CD distribution string (e.g., "101:0.66,103:0.34") or None if no match found
    """

    if geom is None or geom.is_empty:
        return None

    if not geom.is_valid:
        try:
            geom = geom.buffer(0)
            if geom is None or geom.is_empty or not geom.is_valid:
                return None
        except Exception:
            return None

    try:
        # Logic for Points and MultiPoints
        if geom.geom_type == 'Point':
             with warnings.catch_warnings():
                 warnings.filterwarnings("ignore", category=RuntimeWarning, module='shapely.predicates|shapely.set_operations')
                 warnings.filterwarnings("ignore", category=ShapelyDeprecationWarning)

                 possible_matches_idx = list(cd_gdf.sindex.query(geom, predicate='contains'))
                 if not possible_matches_idx:
                     possible_matches_idx = list(cd_gdf.sindex.query(geom, predicate='intersects'))

             if possible_matches_idx:
                cds = cd_gdf.loc[possible_matches_idx]
                
                # Prioritize by borough if specified
                if borough_id is not None:
                    borough_matches = cds[cds['BoroCD'] // 100 == borough_id]
                    if len(borough_matches) > 0:
                        cd = int(borough_matches.iloc[0]['BoroCD'])
                        return f"{cd}:1.00"
                
                # Fall back to first match if no borough match
                cd = int(cds.iloc[0]['BoroCD'])
                return f"{cd}:1.00"

             if use_nearest_fallback:
                 distances = cd_gdf.geometry.distance(geom)
                 
                 # Filter by borough if specified
                 if borough_id is not None:
                     borough_mask = cd_gdf['BoroCD'] // 100 == borough_id
                     borough_distances = distances[borough_mask]
                     if len(borough_distances) > 0:
                         nearest_idx = borough_distances.idxmin()
                         nearest_distance = borough_distances[nearest_idx]
                         if nearest_distance <= max_distance:
                             cd = int(cd_gdf.loc[nearest_idx, 'BoroCD'])
                             return f"{cd}:1.00"
                 
                 # Fall back to any borough
                 nearest_idx = distances.idxmin()
                 nearest_distance = distances[nearest_idx]
                 if nearest_distance <= max_distance:
                     cd = int(cd_gdf.loc[nearest_idx, 'BoroCD'])
                     return f"{cd}:1.00"
             return None

        if geom.geom_type == 'MultiPoint':
            geom_centroid = geom.centroid
            if geom_centroid.is_empty: return None
            return find_cd_by_intersection_length(geom_centroid, cd_gdf, 
                                                 use_nearest_fallback, max_distance,
                                                 debug_index, borough_id)

        # Logic for Polygons and MultiPolygons
        if geom.geom_type in ['Polygon', 'MultiPolygon']:
            intersectable_geom = geom.boundary
        else:
            intersectable_geom = geom

        if intersectable_geom is None or intersectable_geom.is_empty:
            geom_centroid = geom.centroid
            if geom_centroid.is_empty: return None
            return find_cd_by_intersection_length(geom_centroid, cd_gdf, 
                                                 use_nearest_fallback, max_distance,
                                                 debug_index, borough_id)

        if not intersectable_geom.is_valid:
             try:
                 intersectable_geom = intersectable_geom.buffer(0)
                 if intersectable_geom is None or intersectable_geom.is_empty or not intersectable_geom.is_valid:
                     geom_centroid = geom.centroid
                     if geom_centroid.is_empty: return None
                     return find_cd_by_intersection_length(geom_centroid, cd_gdf, 
                                                          use_nearest_fallback, max_distance,
                                                          debug_index, borough_id)
             except Exception:
                 geom_centroid = geom.centroid
                 if geom_centroid.is_empty: return None
                 return find_cd_by_intersection_length(geom_centroid, cd_gdf, 
                                                      use_nearest_fallback, max_distance,
                                                      debug_index, borough_id)

        total_length = intersectable_geom.length
        if total_length < 1e-6:
            geom_centroid = geom.centroid
            if geom_centroid.is_empty: return None
            return find_cd_by_intersection_length(geom_centroid, cd_gdf, 
                                                 use_nearest_fallback, max_distance,
                                                 debug_index, borough_id)

        cd_lengths = {}
        possible_matches_idx = []
        
        # Use Spatial Index with Warning Suppression
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", category=RuntimeWarning, module='shapely.predicates|shapely.set_operations')
            warnings.filterwarnings("ignore", category=ShapelyDeprecationWarning)
            try:
                possible_matches_idx = list(cd_gdf.sindex.query(geom, predicate='intersects'))
            except Exception:
                try:
                    possible_matches_idx = list(cd_gdf.sindex.query(intersectable_geom, predicate='intersects'))
                except Exception:
                    possible_matches_idx = []

        if not possible_matches_idx:
            if use_nearest_fallback:
                try:
                    distances = cd_gdf.geometry.distance(geom)
                    
                    # Prioritize by borough if specified
                    if borough_id is not None:
                        borough_mask = cd_gdf['BoroCD'] // 100 == borough_id
                        borough_distances = distances[borough_mask]
                        if len(borough_distances) > 0:
                            nearest_idx = borough_distances.idxmin()
                            nearest_distance = borough_distances[nearest_idx]
                            if nearest_distance <= max_distance:
                                cd = int(cd_gdf.loc[nearest_idx, 'BoroCD'])
                                return f"{cd}:1.00"
                    
                    # Fall back to any borough
                    nearest_idx = distances.idxmin()
                    nearest_distance = distances[nearest_idx]
                    if nearest_distance <= max_distance:
                        cd = int(cd_gdf.loc[nearest_idx, 'BoroCD'])
                        return f"{cd}:1.00"
                except Exception:
                    pass
            return None

        potential_cds = cd_gdf.loc[possible_matches_idx]
        
        # Filter by borough FIRST if specified
        if borough_id is not None:
            borough_potential = potential_cds[potential_cds['BoroCD'] // 100 == borough_id]
            # If we have candidates in the target borough, use only those
            if len(borough_potential) > 0:
                potential_cds = borough_potential

        # Calculate Intersection Length with Warning Suppression
        for idx, cd_row in potential_cds.iterrows():
            try:
                cd_geom = cd_row.geometry

                if not intersectable_geom.is_valid:
                     intersectable_geom = intersectable_geom.buffer(0)
                     if intersectable_geom.is_empty: continue

                intersection = None
                with warnings.catch_warnings():
                    warnings.filterwarnings("ignore", category=RuntimeWarning, module='shapely.set_operations')
                    warnings.filterwarnings("ignore", category=ShapelyDeprecationWarning)
                    intersection = intersectable_geom.intersection(cd_geom)

                if intersection is None or intersection.is_empty:
                    continue

                intersect_length = 0.0
                if intersection.geom_type in ['LineString', 'MultiLineString']:
                    intersect_length = intersection.length
                elif intersection.geom_type == 'Point':
                    intersect_length = 0.1
                elif intersection.geom_type == 'MultiPoint':
                    intersect_length = len(intersection.geoms) * 0.1
                elif intersection.geom_type == 'GeometryCollection':
                    for g in intersection.geoms:
                        if g.geom_type in ['LineString', 'MultiLineString']:
                            intersect_length += g.length
                        elif g.geom_type in ['Point', 'MultiPoint']:
                            intersect_length += 0.1 * (len(g.geoms) if g.geom_type == 'MultiPoint' else 1)

                if intersect_length > 1e-6:
                    cd = int(cd_row['BoroCD'])
                    cd_lengths[cd] = cd_lengths.get(cd, 0) + intersect_length

            except Exception:
                continue

        # Final Processing with Borough Prioritization
        if not cd_lengths:
            if use_nearest_fallback:
                try:
                    distances = cd_gdf.geometry.distance(geom)
                    
                    # Prioritize by borough if specified
                    if borough_id is not None:
                        borough_mask = cd_gdf['BoroCD'] // 100 == borough_id
                        borough_distances = distances[borough_mask]
                        if len(borough_distances) > 0:
                            nearest_idx = borough_distances.idxmin()
                            nearest_distance = borough_distances[nearest_idx]
                            if nearest_distance <= max_distance:
                                cd = int(cd_gdf.loc[nearest_idx, 'BoroCD'])
                                return f"{cd}:1.00"
                    
                    # Fall back to any borough
                    nearest_idx = distances.idxmin()
                    nearest_distance = distances[nearest_idx]
                    if nearest_distance <= max_distance:
                        cd = int(cd_gdf.loc[nearest_idx, 'BoroCD'])
                        return f"{cd}:1.00"
                except Exception:
                    pass
            return None

        # Apply borough prioritization to intersection results
        if borough_id is not None:
            # Separate CDs by borough match
            borough_cds = {cd: length for cd, length in cd_lengths.items() 
                          if cd // 100 == borough_id}
            other_cds = {cd: length for cd, length in cd_lengths.items() 
                        if cd // 100 != borough_id}
            
            # If there are CDs in the target borough, strongly prioritize them
            if borough_cds:
                
                cd_lengths = borough_cds
            else:
                pass

        total_intersect_length = sum(cd_lengths.values())
        if total_intersect_length < 1e-6:
            if use_nearest_fallback:
                try:
                    distances = cd_gdf.geometry.distance(geom)
                    
                    if borough_id is not None:
                        borough_mask = cd_gdf['BoroCD'] // 100 == borough_id
                        borough_distances = distances[borough_mask]
                        if len(borough_distances) > 0:
                            nearest_idx = borough_distances.idxmin()
                            nearest_distance = borough_distances[nearest_idx]
                            if nearest_distance <= max_distance:
                                cd = int(cd_gdf.loc[nearest_idx, 'BoroCD'])
                                return f"{cd}:1.00"
                    
                    nearest_idx = distances.idxmin()
                    nearest_distance = distances[nearest_idx]
                    if nearest_distance <= max_distance:
                        cd = int(cd_gdf.loc[nearest_idx, 'BoroCD'])
                        return f"{cd}:1.00"
                except Exception:
                    pass
            return None

        sorted_cds = sorted(cd_lengths.items(), key=lambda item: (-item[1], item[0]))
        cd_dist_parts = []
        for i, (cd, length) in enumerate(sorted_cds):
            proportion = length / total_intersect_length
            if len(sorted_cds) == 1:
                 cd_dist_parts.append(f"{cd}:1.00")
                 break
            if proportion >= 0.005 or i == 0:
                 cd_dist_parts.append(f"{cd}:{proportion:.2f}")

        # Renormalize proportions if small ones were dropped
        if len(cd_dist_parts) > 1:
            temp_props = {}
            total_prop = 0.0
            for part in cd_dist_parts:
                cd_str, prop_str = part.split(':')
                prop = float(prop_str)
                temp_props[int(cd_str)] = prop
                total_prop += prop

            if total_prop > 0 and abs(total_prop - 1.0) > 0.01:
                cd_dist_parts = []
                for cd in sorted(temp_props.keys()):
                    norm_prop = temp_props[cd] / total_prop
                    cd_dist_parts.append(f"{cd}:{norm_prop:.2f}")

        if not cd_dist_parts: return None
        return ",".join(cd_dist_parts)

    except Exception:
        return None


def bulk_find_cds_by_length(geometries_with_index, cd_gdf, batch_size=1000,
                            use_nearest_fallback=True, max_distance=500, 
                            borough_ids=None, verbose=False):
    """
    Find community districts for multiple geometries using intersection length. 
    Processes in batches to show progress and improve performance.

    Parameters:
    -----------
    geometries_with_index : list of tuple
        List of (index, geometry) tuples
    cd_gdf : geopandas.GeoDataFrame
        GeoDataFrame with community district boundaries
    batch_size : int
        Number of geometries to process before showing progress
    use_nearest_fallback : bool
        If True, use nearest CD for geometries outside boundaries
    max_distance : float
        Maximum distance in feet for nearest fallback
    borough_ids : list of int or None
        List of borough IDs corresponding to each geometry, or None
    verbose : bool
        Show progress messages
        
    Returns:
    --------
    list of str
        CD distribution strings for each geometry
    """

    results = []
    total = len(geometries_with_index)
    
    for i in range(0, total, batch_size):
        batch = geometries_with_index[i:i+batch_size] 
        
        for idx, geom in batch:
            borough_id = None
            if borough_ids is not None and idx < len(borough_ids):
                borough_id = borough_ids[idx]
                
            cd_dist = find_cd_by_intersection_length(
                geom, cd_gdf, 
                use_nearest_fallback, max_distance,
                debug_index=idx, borough_id=borough_id
            )
            results.append(cd_dist)
        
        if verbose and (i + batch_size) % (batch_size * 10) == 0:
            processed = min(i + batch_size, total)
            print(f"  Processed {processed:,}/{total:,} geometries ({100*processed/total:.1f}%)")
    
    return results
