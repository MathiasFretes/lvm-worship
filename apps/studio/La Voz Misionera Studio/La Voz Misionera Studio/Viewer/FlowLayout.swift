//
//  FlowLayout.swift
//  La Voz Misionera Studio
//
//  Left-to-right wrapping layout — the SwiftUI equivalent of the React Native
//  `flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end'` row that
//  apps/mobile's ChordChart uses for chord-over-word cells. Children keep their
//  natural size and are bottom-aligned within each row so lyric baselines line up
//  whether or not a cell has a chord above it.
//

import SwiftUI

struct FlowLayout: Layout {
    var horizontalSpacing: CGFloat = 6
    var verticalSpacing: CGFloat = 2

    struct Cache {
        var sizes: [CGSize]
    }

    func makeCache(subviews: Subviews) -> Cache {
        Cache(sizes: measure(subviews))
    }

    func updateCache(_ cache: inout Cache, subviews: Subviews) {
        cache.sizes = measure(subviews)
    }

    func sizeThatFits(
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout Cache
    ) -> CGSize {
        let availableWidth = proposal.width.map { max(0, $0) } ?? .infinity
        let rows = arrange(sizes: cache.sizes, maxWidth: availableWidth)
        let contentWidth = rows.map(\.width).max() ?? 0
        return CGSize(
            width: availableWidth.isFinite ? min(contentWidth, availableWidth) : contentWidth,
            height: totalHeight(of: rows)
        )
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout Cache
    ) {
        let rows = arrange(sizes: cache.sizes, maxWidth: max(0, bounds.width))
        var y = bounds.minY

        for row in rows {
            var x = bounds.minX
            for element in row.elements {
                // Bottom-aligned: taller neighbours (a cell with a chord) push
                // shorter ones down so the lyrics share a baseline.
                subviews[element.index].place(
                    at: CGPoint(x: x, y: y + row.height - element.size.height),
                    anchor: .topLeading,
                    proposal: ProposedViewSize(element.size)
                )
                x += element.size.width + horizontalSpacing
            }
            y += row.height + verticalSpacing
        }
    }

    private struct Element {
        let index: Int
        let size: CGSize
    }

    private struct Row {
        var elements: [Element] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    private func measure(_ subviews: Subviews) -> [CGSize] {
        subviews.map { $0.sizeThatFits(.unspecified) }
    }

    private func arrange(sizes: [CGSize], maxWidth: CGFloat) -> [Row] {
        var rows: [Row] = []
        var current = Row()

        for (index, size) in sizes.enumerated() {
            let spacing = current.elements.isEmpty ? 0 : horizontalSpacing
            let projectedWidth = current.width + spacing + size.width
            if !current.elements.isEmpty && projectedWidth > maxWidth {
                rows.append(current)
                current = Row(
                    elements: [Element(index: index, size: size)],
                    width: size.width,
                    height: size.height
                )
                continue
            }
            current.elements.append(Element(index: index, size: size))
            current.width = projectedWidth
            current.height = max(current.height, size.height)
        }

        if !current.elements.isEmpty { rows.append(current) }
        return rows
    }

    private func totalHeight(of rows: [Row]) -> CGFloat {
        guard !rows.isEmpty else { return 0 }
        return rows.reduce(0) { $0 + $1.height }
            + CGFloat(rows.count - 1) * verticalSpacing
    }
}
