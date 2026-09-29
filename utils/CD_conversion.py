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


def parse_cd_distribution(cd_dist_str):
    """Parse CD distribution string into a dictionary."""
    
    if pd.isna(cd_dist_str) or cd_dist_str is None:
        return {}
    try:
        result = {}
        parts = cd_dist_str.split(',')
        for part in parts:
            cd, prop = part.split(':')
            result[int(cd)] = float(prop)
        return result
    except:
        return {}


def get_primary_cd(cd_dict):
    """Get CD with highest proportion."""
    if not cd_dict:
        return None
    return int(max(cd_dict.items(), key=lambda x: x[1])[0])


def add_community_districts(df, wkt_column='wkt', borough_column='boroughname',
                           cache_file='data/NYC_DCP_GeoJSON.geojson', verbose=False,
                           include_sparse_columns=False, batch_size=5000,
                           use_nearest_fallback=True, max_distance=500,
                           diagnose_unmatched=True):

    """
    Add community district information to DataFrame based on WKT geometries.

    Uses geometric intersection length for accurate calculation with borough prioritization for boundary cases.

    IMPORTANT: All WKT geometries must be in EPSG:2263 (NY Long Island State Plane, FIPS 3104)

    Parameters:
    -----------
    df : pandas.DataFrame
        DataFrame with WKT geometry column (in EPSG:2263)
    wkt_column : str
        Name of column containing WKT geometry strings
    borough_column : str
        Name of column containing borough names (e.g., 'MANHATTAN', 'BRONX')
    cache_file : str
        Path to cache the CD GeoJSON data
    verbose : bool
        Print progress messages
    include_sparse_columns : bool
        If True, create individual cd_XXX_portion columns
    batch_size : int, default 5000
        Number of rows to process before showing progress
    use_nearest_fallback : bool, default True
        Assign nearest CD to geometries outside boundaries
    max_distance : float, default 500
        Maximum distance in feet for nearest fallback
    diagnose_unmatched : bool, default True
        Print diagnosis info for unmatched geometries
        
    Returns:
    --------
    pandas.DataFrame
        Input DataFrame with added columns:
        - geom_type: Type of geometry
        - num_points: Number of points in geometry
        - est_distance: Total distance/perimeter in feet
        - cd_wkt_string: String representation of CD distribution
        - cd_wkt_dict: Dictionary of CD proportions
        - primary_cd: CD with highest proportion
        - cd_{XXX}_portion: Individual columns (only if include_sparse_columns=True)
    """
    df = df.copy()

    if wkt_column not in df.columns:
        raise ValueError(f"Column '{wkt_column}' not found in DataFrame")

    # Download/load community district data
    cd_gdf = download_cd_geodata(cache_file)

    if verbose:
        print(f"\nIMPORTANT: Input WKT assumed to be EPSG:2263 (NY Long Island State Plane)")
        if borough_column in df.columns:
            print(f"Using borough column '{borough_column}' for boundary prioritization")

    # Extract geometries and info from WKT
    if verbose: print("\nParsing WKT geometries (assuming EPSG:2263)...")

    geom_info = df[wkt_column].apply(extract_geometry_info)
    df['geometry'] = geom_info.apply(lambda x: x[0])
    df['geom_type'] = geom_info.apply(lambda x: x[1])
    df['num_points'] = geom_info.apply(lambda x: x[2])
    
    if verbose:
        print(f"Parsed {df['geometry'].notna().sum():,} geometries")
        geom_type_counts = df['geom_type'].value_counts()
        for geom_type, count in geom_type_counts.items():
            print(f"  - {geom_type}: {count:,}")
    
    # Calculate distances
    if verbose:
        print("\nCalculating distances/perimeters...")
    
    df['est_distance'] = df['geometry'].apply(calculate_distance)
    
    if verbose:
        distance_stats = df['est_distance'].dropna().describe()
        print(f"Distance statistics:")
        print(f"  Mean: {distance_stats['mean']:.2f} feet")
        print(f"  Median: {distance_stats['50%']:.2f} feet")
        print(f"  Max: {distance_stats['max']:.2f} feet")
    
    # Extract borough IDs for prioritization
    borough_ids = None
    if borough_column in df.columns:
        if verbose:
            print(f"\nExtracting borough IDs from '{borough_column}' column...")
        borough_ids = df[borough_column].apply(get_borough_id).tolist()
        
        if verbose:
            borough_counts = df[borough_column].value_counts()
            print(f"Borough distribution:")
            for boro, count in borough_counts.items():
                boro_id = get_borough_id(boro)
                print(f"  - {boro} (ID: {boro_id}): {count:,}")
    
    # Diagnose coordinate ranges
    if verbose and diagnose_unmatched:
        print("\nDiagnosing coordinate ranges...")
        valid_geoms = df[df['geometry'].notna()]
        
        if len(valid_geoms) > 0:
            sample_size = min(1000, len(valid_geoms))
            sample_geoms = valid_geoms['geometry'].sample(n=sample_size, random_state=42)
            
            x_coords = []
            y_coords = []
            
            for geom in sample_geoms:
                try:
                    if geom.geom_type == 'Point':
                        x_coords.append(geom.x)
                        y_coords.append(geom.y)
                    elif geom.geom_type == 'LineString':
                        coords = list(geom.coords)[:5]
                        x_coords.extend([c[0] for c in coords])
                        y_coords.extend([c[1] for c in coords])
                except:
                    continue
            
            if x_coords and y_coords:
                print(f"\nSample coordinate ranges:")
                print(f"  X: {min(x_coords):.2f} to {max(x_coords):.2f}")
                print(f"  Y: {min(y_coords):.2f} to {max(y_coords):.2f}")
                print(f"\nExpected for EPSG:2263 (NY State Plane):")
                print(f"  X: ~900,000 to ~1,100,000")
                print(f"  Y: ~100,000 to ~300,000")
                
                avg_x = sum(x_coords) / len(x_coords)
                avg_y = sum(y_coords) / len(y_coords)
                
                if not (900000 <= avg_x <= 1100000 and 100000 <= avg_y <= 300000):
                    print(f"\n⚠️  WARNING: Coordinates don't match EPSG:2263!")
                    print(f"   Your data might be in a different CRS.")
                    if abs(avg_x) < 200 and abs(avg_y) < 100:
                        print(f"   Looks like lat/lon (EPSG:4326) - need to convert!")
    
    if verbose:
        print("\nFinding community districts (intersection length method with borough prioritization)...")
        if use_nearest_fallback:
            print(f"Using nearest CD fallback (max distance: {max_distance} feet)")
        print(f"Processing {len(df):,} geometries...")
    
    geometries_with_index = list(zip(df.index, df['geometry'].tolist()))
    cd_distributions = bulk_find_cds_by_length(
        geometries_with_index, cd_gdf, batch_size, 
        use_nearest_fallback, max_distance, 
        borough_ids, verbose
    )
    
    df['cd_wkt_string'] = cd_distributions
    
    if verbose:
        print(f"Completed CD assignment")
    
    # Parse CD distributions
    df['cd_wkt_dict'] = df['cd_wkt_string'].apply(parse_cd_distribution)
    df['primary_cd'] = df['cd_wkt_dict'].apply(get_primary_cd)
    
    # Create individual CD columns if needed
    if include_sparse_columns:
        all_cds = set()
        for cd_dict in df['cd_wkt_dict']:
            all_cds.update(cd_dict.keys())
        
        for cd in sorted(all_cds):
            col_name = f'cd_{cd}_portion'
            df[col_name] = df['cd_wkt_dict'].apply(lambda x: x.get(cd, 0.0))
        
        if verbose:
            print(f"\nCreated {len(all_cds)} CD portion columns")
    
    if verbose:
        print("\n" + "="*60)
        print("SUMMARY")
        print("="*60)
        matched = df['cd_wkt_string'].notna().sum()
        total_valid = df[wkt_column].notna().sum()
        
        print(f"Rows with CD assigned: {matched:,}")
        if total_valid > 0:
            match_rate = matched / total_valid * 100
            print(f"Match rate: {match_rate:.1f}%")
            
            unmatched_count = total_valid - matched
            if unmatched_count > 0:
                print(f"\n {unmatched_count:,} geometries could not be matched to a CD")
                print(f"   This usually means they are outside NYC boundaries or have the wrong CRS.")
                if not use_nearest_fallback:
                    print(f"   Try setting use_nearest_fallback=True")
        
        multi_cd = df[df['cd_wkt_string'].notna() & 
                     df['cd_wkt_string'].str.contains(',')]
        if len(multi_cd) > 0:
            print(f"\nGeometries spanning multiple CDs: {len(multi_cd):,}")
            print(f"  ({100*len(multi_cd)/matched:.1f}% of matched geometries)")
        
        print("\nTop 10 Primary Community Districts:")

        if matched > 0:
            cd_dist = df['primary_cd'].value_counts().head(10)
            for cd, count in cd_dist.items():
                borough_id = cd // 100
                borough_name = [k for k, v in BOROUGH_IDS.items() if v == borough_id][0]
                cd_num = cd % 100
                print(f" CD {cd} ({borough_name} {cd_num:02d}): {count:,} ({100*count/matched:.1f}%)")
        else:
            print("No geometries were matched to any CD.")
        
        # Borough match analysis
        if borough_column in df.columns and matched > 0:
            print("\nBorough Match Analysis:")
            df_matched = df[df['primary_cd'].notna()].copy()
            df_matched['assigned_borough'] = df_matched['primary_cd'].apply(lambda x: x // 100 if pd.notna(x) else None)
            df_matched['input_borough_id'] = df_matched[borough_column].apply(get_borough_id)
            
            borough_match = (df_matched['assigned_borough'] == df_matched['input_borough_id']).sum()
            print(f"  Geometries matched to correct borough: {borough_match:,} ({100*borough_match/len(df_matched):.1f}%)")
    
    # Fix data types, use original data 'permitlinearfeet' if available or estimated construction footage, clean up columns 

    df['primary_cd'] = df['primary_cd'].astype(str).str.replace(r'\.0$', '', regex=True)

    df['est_distance'] = np.where(df['permitlinearfeet'].notna(),
                                  df['permitlinearfeet'],
                                  df['est_distance'])
    
    df = df.drop(columns=['geom_type', 'num_points', 'cd_wkt_string', 'permitlinearfeet', 'geometry'])
    
    return df


def get_first_coordinate(wkt_str):
    try:
        geom = wkt.loads(wkt_str)
        if geom.geom_type == 'Point':
            return geom.x, geom.y
        elif geom.geom_type in ['LineString', 'LinearRing']:
            return geom.coords[0]
        elif geom.geom_type.startswith('Multi') or geom.geom_type == 'GeometryCollection':
            # Take first sub-geometry’s first coordinate
            for g in geom.geoms:
                if hasattr(g, 'coords'):
                    return g.coords[0]
            return None
        else:
            return None
    except Exception:
        return None