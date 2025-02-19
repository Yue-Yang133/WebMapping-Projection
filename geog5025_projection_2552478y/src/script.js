
// 设置 Mapbox 访问令牌
mapboxgl.accessToken = 'pk.eyJ1IjoieXlyYWJiaXQiLCJhIjoiY201d2o2cXFtMDJ2YTJsc2Iyd2xpZW85ZSJ9.GA-F4Xr7nBcpG2jY7yZg9A';

// 初始化地图时使用自定义样式
const customStyle = 'mapbox://styles/yyrabbit/cm7ahdzrs003t01r725j8ejnd'; 
const outdoorsStyle = 'mapbox://styles/mapbox/outdoors-v11';

// 追踪当前模式
let is3DMode = false;

const map = new mapboxgl.Map({
    container: 'map',
    style: customStyle,
    center: [101, 25],
    zoom: 6,
    pitch: 20
});


map.on('load', function() {
    // 添加 3D 地形数据
    map.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.terrain-rgb',
        tileSize: 512,
        maxzoom: 14
    });
    map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
    map.addLayer({
        id: 'hillshade',
        source: 'mapbox-dem',
        type: 'hillshade'
    });

   // 加载 GBIF 观测点数据
    map.addSource('monkeys', {
        type: 'geojson',
        data: 'https://api.mapbox.com/datasets/v1/yyrabbit/cm7aedpuy08my1puy8dk8o302/features?access_token=pk.eyJ1IjoieXlyYWJiaXQiLCJhIjoiY201d2o2cXFtMDJ2YTJsc2Iyd2xpZW85ZSJ9.GA-F4Xr7nBcpG2jY7yZg9A',
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50
    });

    // 1.使用 symbol 图层展示自定义猴子图标
    map.loadImage('https://raw.githubusercontent.com/Yue-Yang133/monkey-icons-2/main/icons8-see-no-evil-monkey-48.png', (error, image) => {
        if (error) throw error;
        map.addImage('monkey-icon', image);
        map.addLayer({
            id: 'monkeys-layer',
            type: 'symbol',
            source: 'monkeys',
            filter: ['!', ['has', 'point_count']],
            layout: {
                'icon-image': 'monkey-icon',
                'icon-size': 0.6,
                'icon-allow-overlap': true
            }
        });
    });

// 2.设置年份滑块
const yearSlider = document.getElementById('year-slider');
const yearValue = document.getElementById('year-value');

yearSlider.addEventListener('input', (event) => {
    // 获取当前选择的年份
    const selectedYear = parseInt(event.target.value);
    
    // 更新 UI 显示当前选择的年份
    yearValue.innerText = selectedYear;

    // 格式化年份（确保是 `YYYY` 格式）
    const formattedYear = selectedYear.toString();

    // 创建 Mapbox 过滤条件（只显示选定年份的数据）
    const filterYear = ['==', ['get', 'year'], formattedYear];

    // 确保 `monkeys` 数据源已加载
    if (map.getSource('monkeys')) {
        // 直接更新 `monkeys-layer`，不会影响聚合点和热力图
        map.setFilter('monkeys-layer', filterYear);
        console.log(`Filter applied: Showing data for year ${formattedYear}`);

        // 确保 `monkeys-layer` 仍然使用 `monkey-icon`
        map.setLayoutProperty('monkeys-layer', 'icon-image', 'monkey-icon');
    } else {
        console.warn("`monkeys` source not found! Make sure it is added before filtering.");
    }
});


  
  // 3.添加聚合点图层
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'monkeys',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': [
        'step',
        ['get', 'point_count'],
        '#51bbd6',
        10,
        '#f1f075',
        30,
        '#f28cb1'
      ],
      'circle-radius': [
        'step',
        ['get', 'point_count'],
        15,
        10,
        20,
        30,
        25
      ]
    }
  });

  // 4.添加聚合数量标签
  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'monkeys',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': '{point_count_abbreviated}',
      'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
      'text-size': 12
    }
  });

  // 5.添加热力图层显示数据密度
  map.addLayer({
    id: 'monkeys-heatmap',
    type: 'heatmap',
    source: 'monkeys',
    maxzoom: 9,
    paint: {
      'heatmap-weight': ['interpolate', ['linear'], ['get', 'group_size'], 1, 0, 20, 1],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 3],
      'heatmap-color': [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0, 'rgba(33,102,172,0)',
        0.2, 'rgb(103,169,207)',
        0.4, 'rgb(209,229,240)',
        0.6, 'rgb(253,219,199)',
        0.8, 'rgb(239,138,98)',
        1, 'rgb(178,24,43)'
      ],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 9, 20],
      'heatmap-opacity': 0.6
    }
  });

 // 6.为 GBIF 点数据添加点击弹出功能
map.on('click', 'monkeys-layer', (e) => {
    if (!e.features || e.features.length === 0) {
        console.warn("No feature found at clicked location.");
        return;
    }

    const feature = e.features[0];
    const coordinates = feature.geometry.coordinates.slice();
    const props = feature.properties;
    const popupContent = `
        <strong>Location:</strong> ${props.location || 'Unknown'}<br>
        <strong>Date:</strong> ${props.eventDate || 'Unknown'}<br>
        <strong>Year:</strong> ${props.year || 'Unknown'}
    `;

    new mapboxgl.Popup()
        .setLngLat(coordinates)
        .setHTML(popupContent)
        .addTo(map);
});



  // 7.鼠标悬停改变光标样式
  map.on('mouseenter', 'monkeys-layer', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'monkeys-layer', () => {
    map.getCanvas().style.cursor = '';
  });

  
    // 加载 IUCN 栖息地数据
    map.addSource('habitat', {
        type: 'geojson',
        data: 'https://api.mapbox.com/datasets/v1/yyrabbit/cm7ahm1z75zll1nqijujc8qro/features?access_token=pk.eyJ1IjoieXlyYWJiaXQiLCJhIjoiY201d2o2cXFtMDJ2YTJsc2Iyd2xpZW85ZSJ9.GA-F4Xr7nBcpG2jY7yZg9A'
    });

    // 添加栖息地面数据
    map.addLayer({
        id: 'habitat-layer',
        type: 'fill',
        source: 'habitat',
        layout: { visibility: 'visible' },
        paint: {
            'fill-color': '#008000',
            'fill-opacity': 0.4
        }
    });

 
    // 8.栖息地开关
    const toggleBtn = document.getElementById('toggle-habitat');
    toggleBtn.addEventListener('click', () => {
        const visibility = map.getLayoutProperty('habitat-layer', 'visibility');
        if (visibility === 'visible') {
            map.setLayoutProperty('habitat-layer', 'visibility', 'none');
            toggleBtn.innerText = 'Show Habitat Layer';
        } else {
            map.setLayoutProperty('habitat-layer', 'visibility', 'visible');
            toggleBtn.innerText = 'Hide Habitat Layer';
        }
    });
});