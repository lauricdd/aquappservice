import { Component, OnInit, ElementRef, NgZone } from '@angular/core';
import {
  tileLayer,
  latLng,
  Map,
  geoJSON,
  FeatureGroup,
  Marker,
  DivIcon,
  latLngBounds
} from 'leaflet';
import { Subscription } from 'rxjs';
import {
  animate,
  state,
  style,
  transition,
  trigger
} from '@angular/animations';
import { Router } from '@angular/router';
import { WaterBody } from 'src/app/models/water-body.model';
import { IcampffAvg } from 'src/app/models/icampff-avg.model';
import { ApiService } from 'src/app/services/api/api.service';
import { TranslateService } from 'src/app/services/translate/translate.service';
import { TranslatePipe } from 'src/app/services/translate/translate.pipe';
import { Node } from 'src/app/models/node.model';

@Component({
  selector: 'app-overview',
  templateUrl: './overview.component.html',
  styleUrls: ['./overview.component.scss'],
  animations: [
    trigger('fadeInOut', [
      state(
        'void',
        style({
          opacity: 0,
          height: '0px',
          display: 'none'
        })
      ),
      transition('void <=> *', animate(225))
    ])
  ]
})
export class OverviewComponent implements OnInit {
  mapOptions = {
    layers: [
      tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: 'Map data © OpenStreetMap contributors'
      })
    ],
    zoom: 13.5,
    center: latLng(10.4241961, -75.535)
  };
  mapStyle: any = {
    height: '100%',
    width: '100%'
  };

  map: Map;
  figures: FeatureGroup = new FeatureGroup();
  markers: Marker[];

  waterQualityVariables: string[];
  hydroMetereologicVariables: string[];
  weatherStationVariables: string[];

  waterBodies: WaterBody[] = [];
  icampffAvgsPerWaterBody: IcampffAvg[][] = [];

  nodes: Node[];
  selectedNodeType = 'Water Quality';
  selectedNodeTypeId = '59c9d9019a892016ca4be412';
  nodeTypes = [
    {
      id: '59c9d9019a892016ca4be412',
      name: 'Water Quality'
    },
    {
      id: '59c9d9019a892016ca4be413',
      name: 'Hydro-Metereologic Factors'
    },
    {
      id: '5a16342a9a8920290056a542',
      name: 'Weather Station'
    }
  ];

  selectedDate = 'Latest available';
  icamDates: Date[];

  subscription: Subscription;
  loading = true;
  failed = false;

  constructor(
    private apiService: ApiService,
    private translateService: TranslateService,
    private translatePipe: TranslatePipe,
    private router: Router,
    private elementRef: ElementRef,
    private ngZone: NgZone
  ) {
    this.subscription = this.translateService.reload$.subscribe(rmessage => {
      this.reloadFigures();
    });
    window.onresize = () => {
      if (this.map) {
        this.fixMap();
      }
    };
  }

  ngOnInit() {}

  onMapReady(map: Map) {
    this.map = map;
    this.fixMap();
    this.getData();
  }

  fixMap() {
    this.mapStyle = {
      height: '100%',
      width: '100%'
    };
    this.map.invalidateSize();
  }

  async getData() {
    this.loading = true;
    this.failed = false;
    await this.apiService
      .getAllWaterBodies()
      .toPromise()
      .then(
        wbs => (this.waterBodies = wbs),
        () => {
          this.failed = true;
          this.loading = false;
        }
      );
    for (const waterBody of this.waterBodies) {
      await this.apiService
        .getAllIcampff(waterBody.id)
        .toPromise()
        .then(
          ia => this.icampffAvgsPerWaterBody.push(ia),
          () => {
            this.failed = true;
            this.loading = false;
          }
        );
    }
    await this.apiService
      .getAllNodes()
      .toPromise()
      .then(
        page => (this.nodes = page.items),
        () => {
          this.failed = true;
          this.loading = false;
        }
      );
    this.icamDates = [];
    for (const icampffAvgs of this.icampffAvgsPerWaterBody) {
      for (const icampffAvg of icampffAvgs) {
        if (this.icamDates.indexOf(icampffAvg.date) === -1) {
          this.icamDates.push(icampffAvg.date);
        }
      }
    }
    if (this.failed) {
      return;
    }
    this.addFigures();
    this.loading = false;
  }

  addFigures(icampffDate: string = 'Latest available') {
    this.addMarkers(this.selectedNodeTypeId || '');
    this.addWaterBodies(icampffDate);
  }

  addMarkers(nodeTypeId: string = '') {
    this.markers = [];
    for (const node of this.nodes) {
      if (nodeTypeId && nodeTypeId !== node.nodeTypeId) {
        continue;
      }
      let ico_url: string;
      switch (node.status) {
        case 'Real Time':
          ico_url = 'assets/glyph-marker-icon-green.png';
          break;
        case 'Non Real Time':
          ico_url = 'assets/glyph-marker-icon-blue.png';
          break;
        case 'Off':
          ico_url = 'assets/glyph-marker-icon-gray.png';
          break;
        default:
          ico_url = 'assets/glyph-marker-icon-gray.png';
          break;
      }

      let nodeTypeName: string;
      switch (node.nodeTypeId) {
        case '59c9d9019a892016ca4be412':
          nodeTypeName = 'WQ';
          break;
        case '59c9d9019a892016ca4be413':
          nodeTypeName = 'HF';
          break;
        default:
          nodeTypeName = 'WS';
          break;
      }

      nodeTypeName = this.translateService.translate(nodeTypeName);

      const ico = new DivIcon({
        className: 'xolonium',
        html: `
          <div class="container">
            <img
              style="
                position: relative;
                text-align: center;
                color: white;"
              src="${ico_url}"
            ></img>
            <span
              style="
                position: absolute;
                top: 50%;
                left: 50%;
                font-size: 8pt;
                font-family: monospace;
                transform: translate(0, 50%);
                color: #fff;"
            >${nodeTypeName}</span>
          </div>
        `,
        iconSize: [24, 36],
        iconAnchor: [12, 36]
      });
      const marker = new Marker([node.coordinates[0], node.coordinates[1]], {
        title: node.name,
        icon: ico
      });
      marker.bindPopup(`
        <h1>${node.name}</h1>
        <p>${this.translateService.translate('Location')}: ${node.location}</p>
        <a class="passive-link" data-url="formulario-exportar-datos" data-entity1Id="${
          node.id
        }">${this.translateService.translate(
        'Export data'
      )}</a>
      `);
      marker.addTo(this.map);

      const self = this;
      marker.on('popupopen', function() {
        // add event listener to newly added a.merch-link element
        self.elementRef.nativeElement
          .querySelector('.passive-link')
          .addEventListener('click', e => {
            // get id from attribute
            const url = e.target.getAttribute('data-url');
            const id = e.target.getAttribute('data-entity1Id');
            self.ngZone.run(() => {
              self.router.navigate([url], {
                queryParams: {
                  entity1Id: id,
                  entity1Type: 'node'
                }
              });
            });
          });
      });

      this.markers.push(marker);
    }
    if (this.markers.length) {
      this.map.fitBounds(
        latLngBounds(this.markers.map(marker => marker.getLatLng()))
      );
    }
  }

  getColor(icampff: number) {
    return icampff > 90
      ? '#0032FF' // blue
      : icampff > 70
      ? '#49C502' // green
      : icampff > 50
      ? '#F9F107' // yellow
      : icampff > 25
      ? '#F57702' // orange
      : icampff === -1
      ? '#555555'
      : '#FB1502'; // red
  }

  addWaterBodies(icampffDate: string) {
    let index = 0;
    for (const waterBody of this.waterBodies) {
      let icampff: number;
      if (icampffDate === 'Latest available') {
        icampff = this.icampffAvgsPerWaterBody[index].length
          ? this.icampffAvgsPerWaterBody[index][
              this.icampffAvgsPerWaterBody[index].length - 1
            ].value
          : -1;
      } else {
        const icampffIndex: number = this.icampffAvgsPerWaterBody[
          index
        ].findIndex(ica => ica.date.toString() === icampffDate);
        if (icampffIndex === -1) {
          icampff = -1;
        } else {
          icampff = this.icampffAvgsPerWaterBody[index][icampffIndex].value;
        }
      }
      const geojson = geoJSON(JSON.parse(waterBody.geojson), {
        style: {
          weight: 2,
          opacity: 0.3,
          dashArray: '',
          fillColor: this.getColor(icampff),
          color: 'black',
          fillOpacity: 0.7
        }
      });
      geojson.eachLayer(layer => {
        layer.bindPopup(`
          <h1>${waterBody.name}</h1>
          <p>
            ICAMpff: ${
              icampff !== -1
                ? icampff.toFixed(2)
                : this.translateService.translate(
                    'Unavailable for the current date'
                  )
            }
          </p>
          <p>
            ${this.translateService.translate(
              'Meassure date'
            )}: ${this.translatePipe.transform(
          new Date(
            this.icampffAvgsPerWaterBody[index][
              this.icampffAvgsPerWaterBody[index].length - 1
            ].date
          ),
          { type: 'date', fullDate: true }
        )}
          </p>
          <a class="passive-link" data-url="formulario-exportar-datos" data-entity1Id="${
            waterBody.id
          }">${this.translateService.translate(
          'Export data'
        )}</a>
        `);
        const self = this;
        layer.on('popupopen', function() {
          // add event listener to newly added a.merch-link element
          self.elementRef.nativeElement
            .querySelector('.passive-link')
            .addEventListener('click', e => {
              // get id from attribute
              const url = e.target.getAttribute('data-url');
              const id = e.target.getAttribute('data-entity1Id');
              self.ngZone.run(() => {
                self.router.navigate([url], {
                  queryParams: {
                    entity1Id: id,
                    entity1Type: 'waterBody'
                  }
                });
              });
            });
        });
        this.figures.addLayer(layer);
      });
      index++;
    }
    this.figures.addTo(this.map);
  }

  removeFigures() {
    this.removeMarkers();
    this.removeWaterBodies();
  }

  removeMarkers() {
    for (const marker of this.markers) {
      marker.removeFrom(this.map);
    }
    this.markers = [];
  }

  removeWaterBodies() {
    this.figures.getLayers().forEach(layer => {
      this.figures.removeLayer(layer);
    });
    this.figures.removeFrom(this.map);
    this.fixMap();
  }

  selectNodeType(nodeType: string) {
    let found = false;
    for (const nt of this.nodeTypes) {
      if (nt.id === nodeType) {
        found = true;
        this.selectedNodeTypeId = nt.id;
        this.selectedNodeType = nt.name;
        this.removeMarkers();
        this.addMarkers(nt.id);
        break;
      }
    }
    if (!found) {
      this.selectedNodeType = nodeType;
      this.removeMarkers();
      this.addMarkers();
    }
  }

  selectDate(date: Date) {
    this.removeWaterBodies();
    this.addWaterBodies(date.toString());
    this.selectedDate = new Date(date).toDateString();
  }

  reloadFigures() {
    this.removeFigures();
    this.addFigures();
  }
}