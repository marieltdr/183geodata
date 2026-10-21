mapboxgl.accessToken = 'pk.eyJ1IjoibWFyaWVsdGRyIiwiYSI6ImNtaDljY3lnNjA1NzIya3Bwbmw4YThndHMifQ.8xjaPLZ8qauEqwsk7tsrLw';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/marieltdr/cmh9cfchm009g01ra3lh24uro', 
  zoom: 12, 
  center: [-122.275, 37.871],
  touchZoomRotate: true 
});

map.addControl(new mapboxgl.NavigationControl());

map.on('load', function() {
  fetch('https://raw.githubusercontent.com/marieltdr/183geodata/refs/heads/main/183data.geojson')
    .then(res => res.json())
    .then(data => {
      data.features.forEach(f => {
        const dateStr = f.properties["original_*  Designated  *"] || f.properties["Designated"] || "";
        const match = dateStr.match(/\b\d{4}\b/);
        f.properties.year = match ? parseInt(match[0], 10) : null;
      });

      map.addSource('points-data', {
        type: 'geojson',
        data: data,
        generateId: true,
        cluster: true, 
        clusterMaxZoom: 12, 
        clusterRadius: 50 
      });

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'points-data',
        filter: ['has', 'point_count'], 
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#F7DF7C',
            5, '#E8C94D', 
            20, '#E8C21C' 
          ],
          'circle-opacity': 1,
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            20, 
            5, 28, 
            15, 36 
          ],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#FFFFFF'
        }
      });

      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'points-data',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 13
        },
        paint: {
          'text-color': '#FFFFFF'
        }
      });

      map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'points-data',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#11b4da',
          'circle-opacity': 1,
          'circle-radius': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            10,
            6
          ],
          'circle-opacity': 1, 
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#FFFFFF'
        }
      });

      map.on('click', 'clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        const clusterId = features[0].properties.cluster_id;
        
        map.getSource('points-data').getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return;
          map.easeTo({
            center: features[0].geometry.coordinates,
            zoom: zoom
          });
        });
      });

      map.on('click', 'unclustered-point', (e) => {
        const coordinates = e.features[0].geometry.coordinates.slice();
        const properties = e.features[0].properties;

        const landmark = properties["original_*Landmark*"] || properties["Landmark"] || "Heritage Site";
        const address = properties["original_*Address*"] || properties["Address"] || "N/A";
        const archDate = properties["original_*Architect & Date*"] || properties["Architect & Date"] || "N/A";
        const designated = properties["original_*  Designated  *"] || properties["Designated"] || "N/A";
        const notes = properties["original_*Notes*"] || properties["Notes"];
        const link = properties.Link;

        const popupContent = `
          <div style="font-family: sans-serif; padding: 5px;">
            <h3 style="margin: 0 0 5px 0; font-size: 14px;">${landmark}</h3>
            <p style="margin: 3px 0; font-size: 12px;"><strong>Address:</strong> ${address}</p>
            <p style="margin: 3px 0; font-size: 12px;"><strong>Architect & Date:</strong> ${archDate}</p>
            <p style="margin: 3px 0; font-size: 12px;"><strong>Designated:</strong> ${designated}</p>
            ${notes ? `<p style="margin: 3px 0; font-size: 12px;"><strong>Notes:</strong> \${notes}</p>` : ''}
            ${link ? `<p style="margin: 5px 0 0 0;"><a href="\${link}" target="_blank" style="font-size: 12px; color: #0078A8;">More Info</a></p>` : ''}
          </div>
        `;

        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
          coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
        }

        new mapboxgl.Popup()
          .setLngLat(coordinates)
          .setHTML(popupContent)
          .addTo(map);
      });

      let hoveredStateId = null;

      map.on('mouseenter', 'unclustered-point', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mousemove', 'unclustered-point', (e) => {
        if (e.features.length > 0) {
          if (hoveredStateId !== null) {
            map.setFeatureState({ source: 'points-data', id: hoveredStateId }, { hover: false });
          }
          hoveredStateId = e.features[0].id;
          map.setFeatureState({ source: 'points-data', id: hoveredStateId }, { hover: true });
        }
      });

      map.on('mouseleave', 'unclustered-point', () => {
        map.getCanvas().style.cursor = '';
        if (hoveredStateId !== null) {
          map.setFeatureState({ source: 'points-data', id: hoveredStateId }, { hover: false });
        }
        hoveredStateId = null;
      });

      const filterSelect = document.getElementById('date-filter');
      if (filterSelect) {
        filterSelect.addEventListener('change', (e) => {
          const range = e.target.value;

          if (range === 'all') {
            map.setFilter('unclustered-point', ['!', ['has', 'point_count']]);
          } else {
            let yearFilter;
            if (range === 'before-2000') {
              yearFilter = ['<', ['get', 'year'], 2000];
            } else if (range === '2000-2005') {
              yearFilter = ['all', ['>=', ['get', 'year'], 2000], ['<=', ['get', 'year'], 2005]];
            } else if (range === 'after-2005') {
              yearFilter = ['>', ['get', 'year'], 2005];
            }

            map.setFilter('unclustered-point', [
              'all',
              ['!', ['has', 'point_count']],
              ['has', 'year'],
              yearFilter
            ]);
          }
        });
      }
    });
});
