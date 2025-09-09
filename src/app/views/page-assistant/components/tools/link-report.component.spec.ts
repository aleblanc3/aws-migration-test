import { TestBed, ComponentFixture } from '@angular/core/testing';
import { LinkReportComponent } from './link-report.component';
import { UploadStateService } from '../../services/upload-state.service';

class MockUploadStateService {
  getUploadData() {
    const html = `
      <html>
        <body>
          <h1>Section One</h1>

          <a href="#sec1">Section One</a>
          <h2 id="sec1">Section One</h2>

          <a href="/internal/dest.html">Destination Title</a>
          <a href="mailto:help@example.com">Email us</a>
          <a href="https://example.com">External</a>
        </body>
      </html>
    `;

    return {
      originalHtml: html,
      modifiedHtml: html,
      pageUrl: `${location.origin}/start.html`,
    };
  }
}

describe('LinkReportComponent', () => {
  let fixture: ComponentFixture<LinkReportComponent>;
  let component: LinkReportComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LinkReportComponent],
      providers: [
        { provide: UploadStateService, useClass: MockUploadStateService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LinkReportComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    const anyWindow = window as any;
    if (anyWindow.fetch && (anyWindow.fetch as any).and) {
      (anyWindow.fetch as any).and.callThrough?.();
    }
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should parse links and compute anchor match from current document H1', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const rows = component.headings;
    expect(rows.length).toBe(4);

    const anchor = rows.find(
      (r) => r.type === 'anchor' && r.text === 'Section One',
    );
    expect(anchor).toBeTruthy();

    expect(anchor!.destH1).toBe('Section One');
    expect(anchor!.matchStatus).toBe('match');

    const mailto = rows.find((r) => r.type === 'mailto');
    expect(mailto).toBeTruthy();
    expect(mailto!.matchStatus).toBe('na');

    const external = rows.find((r) => r.type === 'external');
    expect(external).toBeTruthy();

    expect(['unknown', 'mismatch', 'match', 'na']).toContain(
      external!.matchStatus,
    );
  });

  it('should resolve same-origin internal link, extract destination H1, and compute match', async () => {
    const absUrl = new URL(
      '/internal/dest.html',
      `${location.origin}/start.html`,
    ).toString();
    spyOn(window as any, 'fetch').and.callFake((url: RequestInfo) => {
      const target = typeof url === 'string' ? url : (url as any).url;
      if (target === absUrl) {
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              `<html><body><h1>Destination Title</h1></body></html>`,
            ),
        } as Response as any);
      }

      return Promise.resolve({
        ok: false,
        text: () => Promise.resolve(''),
      } as Response as any);
    });

    fixture.detectChanges(); // ngOnInit -> extractLinks()
    await fixture.whenStable();

    const rows = component.headings;

    const internal = rows.find(
      (r) => r.type === 'internal' && r.text === 'Destination Title',
    );
    expect(internal).toBeTruthy();

    expect(internal!.destH1).toBe('Destination Title');
    expect(internal!.matchStatus).toBe('match');

    expect(internal!.order).toBeGreaterThan(0);
  });
});
